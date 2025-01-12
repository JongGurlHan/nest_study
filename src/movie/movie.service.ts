import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { MovieDetail } from './entity/movie-detail.entity';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entities/genre.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CommonService } from 'src/common/common.service';
import { join } from 'path';
import { rename } from 'fs/promises';
import { User } from 'src/user/entities/user.entity';
import { MovieUserLike } from './entity/movie-user-like.entity';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class MovieService {
    constructor(
        @InjectRepository(Movie)
        private readonly movieRepository: Repository<Movie>,
        @InjectRepository(MovieDetail)
        private readonly movieDetailRepository: Repository<MovieDetail>,
        @InjectRepository(Director)
        private readonly directorRepository: Repository<Director>,
        @InjectRepository(Genre)
        private readonly genreRepository: Repository<Genre>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(MovieUserLike)
        private readonly movieUserLikeRepository: Repository<MovieUserLike>,
        private readonly dataSource: DataSource,
        private readonly commonService: CommonService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ) {}

    async findRecent() {
        const cacheData = await this.cacheManager.get('MOVIE_RECENT');
        if (cacheData) {
            return cacheData;
        }

        const data = this.movieRepository.find({
            order: {
                createdAt: 'DESC',
            },
            take: 10,
        });

        await this.cacheManager.set('MOVIE_RECENT', data); //서비스단위가 우선 적용된다.

        return data;
    }

    async findAll(dto: GetMoviesDto, userId?: number) {
        const { title } = dto;
        const qb = this.movieRepository
            .createQueryBuilder('movie')
            .leftJoinAndSelect('movie.director', 'director')
            .leftJoinAndSelect('movie.genres', 'genres');

        if (title) {
            qb.where('movie.title LIKE :title', { title: `%${title}%` });
        }

        const { nextCursor } = await this.commonService.applyCursorPaginationParamsToQb(qb, dto); //혹은 서비스 자체를 상속받는 방법도 있다.

        let [data, count] = await qb.getManyAndCount();

        if (userId) {
            const movieIds = data.map(movie => movie.id);

            const likedMovies =
                movieIds.length < 1
                    ? []
                    : await this.movieUserLikeRepository
                          .createQueryBuilder('mul')
                          .leftJoinAndSelect('mul.user', 'user')
                          .leftJoinAndSelect('mul.movie', 'movie')
                          .where('movie.id IN(:...movieIds)', { movieIds })
                          .andWhere('user.id = :userId', { userId })
                          .getMany();

            /**
             * {
             *  movieId: boolean
             * }
             */
            const likedMovieMap = likedMovies.reduce(
                (acc, next) => ({
                    ...acc,
                    [next.movie.id]: next.isLike,
                }),
                {},
            );

            data = data.map(x => ({
                ...x,
                // null || turue || false
                likeStatus: x.id in likedMovieMap ? likedMovieMap[x.id] : null,
            }));
        }

        return {
            data,
            nextCursor,
            count,
        };
    }

    async findOne(id: number) {
        const movie = await this.movieRepository
            .createQueryBuilder('movie')
            .leftJoinAndSelect('movie.director', 'director')
            .leftJoinAndSelect('movie.genres', 'genres')
            .leftJoinAndSelect('movie.detail', 'detail')
            .leftJoinAndSelect('movie.creator', 'creator')
            .where('movie.id = :id', { id })
            .getOne();

        // const movie = await this.movieRepository.findOne({
        //   where: {
        //     id,
        //   },
        //   relations: ['detail', 'director', 'genres']
        // });

        if (!movie) {
            throw new NotFoundException('존재하지 않는 ID의 영화입니다!');
        }

        return movie;
    }

    async create(createMovieDto: CreateMovieDto, userId: number, qr: QueryRunner) {
        const director = await qr.manager.findOne(Director, {
            where: {
                id: createMovieDto.directorId,
            },
        });

        if (!director) {
            throw new NotFoundException('존재하지 않는 ID의 감독입니다!');
        }

        const genres = await qr.manager.find(Genre, {
            where: {
                id: In(createMovieDto.genreIds),
            },
        });

        if (genres.length !== createMovieDto.genreIds.length) {
            throw new NotFoundException(
                `존재하지 않는 장르가 있습니다! 존재하는 ids -> ${genres.map(genre => genre.id).join(',')}`,
            );
        }

        const movieDetail = await qr.manager
            .createQueryBuilder()
            .insert()
            .into(MovieDetail)
            .values({
                detail: createMovieDto.detail,
            })
            .execute();

        const movieDetailId = movieDetail.identifiers[0].id; //생성한 것의 id, value를 여러개 넣을 수 있어서 list다.

        const movieFolder = join('public', 'movie');
        const tempFolder = join('public', 'temp');

        //save는 repository 패턴이 편하다. cascade로 한번에 되기 때문 근데 쿼리빌더에서는 안된다....
        //그래서 쿼리빌터에서 detail을 따로 만들어줘야한다.
        const movie = await qr.manager
            .createQueryBuilder()
            .insert()
            .into(Movie)
            .values({
                title: createMovieDto.title,
                detail: {
                    id: movieDetailId,
                },
                director,
                creator: {
                    id: userId,
                },
                movieFilePath: join(movieFolder, createMovieDto.movieFileName),
            })
            .execute();

        const movieId = movie.identifiers[0].id;

        //many to many 관계는 생성 안됨 그래서 만들어줘야.
        await qr.manager
            .createQueryBuilder()
            .relation(Movie, 'genres')
            .of(movieId)
            .add(genres.map(genre => genre.id));

        //temp -> movie로 옮기기
        // await rename(
        //     join(process.cwd(), tempFolder, createMovieDto.movieFileName),
        //     join(process.cwd(), movieFolder, createMovieDto.movieFileName),
        // );

        //트렌젝션 커밋전 미리 데이터를 본다.
        return await qr.manager.findOne(Movie, {
            where: {
                id: movieId,
            },
            relations: ['detail', 'director', 'genres'],
        });
    }

    async update(id: number, updateMovieDto: UpdateMovieDto) {
        const qr = this.dataSource.createQueryRunner();

        await qr.connect();
        await qr.startTransaction();

        try {
            const movie = await qr.manager.findOne(Movie, {
                where: {
                    title: updateMovieDto.title,
                },
                relations: ['detail', 'genres'],
            });

            if (!movie) {
                throw new NotFoundException('존재하지 않는 ID의 영화입니다!');
            }

            const { detail, directorId, genreIds, ...movieRest } = updateMovieDto;

            let newDirector;
            if (directorId) {
                const director = await qr.manager.findOne(Director, {
                    where: {
                        id: directorId,
                    },
                });

                if (!director) {
                    throw new NotFoundException('존재하지 않는 ID의 감독입니다!');
                }

                newDirector = director;
            }

            let newGenres;
            if (genreIds) {
                const genres = await qr.manager.find(Genre, {
                    where: {
                        id: In(genreIds),
                    },
                });

                if (genres.length !== updateMovieDto.genreIds.length) {
                    throw new NotFoundException(
                        `존재하지 않는 장르가 있습니다! 존재하는 ids -> ${genres.map(genre => genre.id).join(',')}`,
                    );
                }

                newGenres = genres;
            }

            /**
             * {
             *  ...movieRest,
             *  {director:director}
             * }
             *
             * {
             *  ...movieRest,
             *  director: director
             * }
             */
            const movieUpdateFields = {
                ...movieRest,
                ...(newDirector && { director: newDirector }),
            };

            await qr.manager
                .createQueryBuilder()
                .update(Movie)
                .set(movieUpdateFields)
                .where('id = :id', { id })
                .execute();

            // await this.movieRepository.update(
            //   { id },
            //   movieUpdateFields,
            // );

            if (detail) {
                await qr.manager
                    .createQueryBuilder()
                    .update(MovieDetail)
                    .set({ detail })
                    .where('id = :id', { id: movie.detail.id })
                    .execute();
            }

            // await this.movieDetailRepository.update(
            //   {
            //     id: movie.detail.id,
            //   },
            //   {
            //     detail,
            //   }
            // )

            if (newGenres) {
                await qr.manager
                    .createQueryBuilder()
                    .relation(Movie, 'genres')
                    .of(id)
                    .addAndRemove(
                        newGenres.map(genre => genre.id), //추가(받는 데이터를 추가)
                        movie.genres.map(genre => genre.id), //삭제(원래 있던애 삭제)
                    );
            }

            // const newMovie = await this.movieRepository.findOne({
            //   where: {
            //     id,
            //   },
            //   relations: ['detail', 'director']
            // });

            // newMovie.genres = newGenres;

            // await this.movieRepository.save(newMovie);
            await qr.commitTransaction();

            return this.movieRepository.findOne({
                where: {
                    id,
                },
                relations: ['detail', 'director', 'genres'],
            });
        } catch (e) {
            await qr.rollbackTransaction();
            throw e;
        } finally {
            await qr.release();
        }
    }

    async remove(id: number) {
        const movie = await this.movieRepository.findOne({
            where: {
                id,
            },
            relations: ['detail'],
        });

        if (!movie) {
            throw new NotFoundException('존재하지 않는 ID의 영화입니다!');
        }

        await this.movieRepository.createQueryBuilder().delete().where('id = :id', { id }).execute();

        // await this.movieRepository.delete(id);
        await this.movieDetailRepository.delete(movie.detail.id);

        return id;
    }

    async toggleMovieLike(movieId: number, userId: number, isLike: boolean) {
        const movie = await this.movieRepository.findOne({
            where: {
                id: movieId,
            },
        });

        if (!movie) {
            throw new BadRequestException('존재하지 않는 영화입니다!');
        }

        const user = await this.userRepository.findOne({
            where: {
                id: userId,
            },
        });

        if (!user) {
            throw new UnauthorizedException('사용자 정보가 없습니다.!');
        }
        console.log('user', user);

        const likeRecord = await this.movieUserLikeRepository
            .createQueryBuilder('mul')
            .leftJoinAndSelect('mul.movie', 'movie')
            .leftJoinAndSelect('mul.user', 'user')
            .where('movie.id = :movieId', { movieId })
            .andWhere('user.id = :userId', { userId })
            .getOne();

        if (likeRecord) {
            //똑같은 경우
            if (isLike === likeRecord.isLike) {
                await this.movieUserLikeRepository.delete({
                    movie,
                    user,
                });
            } else {
                //다를경우 true -> false 혹은 false -> true
                await this.movieUserLikeRepository.update(
                    {
                        movie,
                        user,
                    },
                    {
                        isLike,
                    },
                );
            }
        } else {
            await this.movieUserLikeRepository.save({
                movie,
                user,
                isLike,
            });
        }

        const result = await this.movieUserLikeRepository
            .createQueryBuilder('mul')
            .leftJoinAndSelect('mul.movie', 'movie')
            .leftJoinAndSelect('mul.user', 'user')
            .where('movie.id = :movieId', { movieId })
            .andWhere('user.id = :userId', { userId })
            .getOne();

        return {
            isLike: result && result.isLike,
        };
    }
}
