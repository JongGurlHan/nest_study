import { Module } from '@nestjs/common';
import { MovieService } from './movie.service';
import { MovieController } from './movie.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entities/genre.entity';
import { Movie } from './entity/movie.entity';
import { MovieDetail } from './entity/movie-detail.entity';
import { CommonModule } from 'src/common/common.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { v4 } from 'uuid';
import { User } from 'src/user/entities/user.entity';
import { MovieUserLike } from './entity/movie-user-like.entity';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    imports: [
        TypeOrmModule.forFeature([Movie, MovieDetail, MovieUserLike, Director, Genre, User]),
        CommonModule,

        // MulterModule.register({
        //     storage: diskStorage({
        //         //.....NEST_STUDY/public/movie
        //         destination: join(process.cwd(), 'public', 'movie'), //cwd:current working directory, 프로젝트의 최상단(루트)
        //         filename: (req, file, cb) => {
        //             const split = file.originalname.split('.');

        //             let extention = 'mp4';

        //             if (split.length > 1) {
        //                 extention = split[split.length - 1];
        //             }

        //             cb(null, `${v4()}_${Date.now()}.${extention}`);
        //         },
        //     }),
        // }),
    ],
    controllers: [MovieController],
    providers: [MovieService],
})
export class MovieModule {}
