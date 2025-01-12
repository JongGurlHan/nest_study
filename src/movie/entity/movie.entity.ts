import { BaseTable } from 'src/common/entity/base-table.entity';
import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entities/genre.entity';
import {
    Column,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { MovieDetail } from './movie-detail.entity';
import { Transform } from 'class-transformer';
import { MovieFilePipe } from '../pipe/movie-file.pipe';
import { User } from 'src/user/entities/user.entity';
import { MovieUserLike } from './movie-user-like.entity';

@Entity()
export class Movie extends BaseTable {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, user => user.createdMovies)
    creator: User;

    @Column({
        unique: true,
    })
    title: string;

    @OneToOne(() => MovieDetail, movieDetail => movieDetail.id, {
        cascade: true,
        nullable: false,
    })
    @JoinColumn()
    detail: MovieDetail;

    @Column()
    @Transform(({ value }) => `http://localhost:3000/${value}`)
    movieFilePath: string;

    @ManyToMany(() => Genre, genre => genre.movies)
    @JoinTable()
    genres: Genre[];

    @Column({
        default: 0,
    })
    likeCount: number;

    @Column({
        default: 0,
    })
    dislikeCount: number;

    @ManyToOne(() => Director, director => director.id, {
        cascade: true, //같이 저장됨
        nullable: false, //NULL이 절대로 될 수 없다.
    })
    director: Director;

    @OneToMany(() => MovieUserLike, mul => mul.movie)
    likedUsers: MovieUserLike[];
}
