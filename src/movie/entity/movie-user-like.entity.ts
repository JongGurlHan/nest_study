import e from 'express';
import { Column, Entity, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Movie } from './movie.entity';
import { User } from 'src/user/entities/user.entity';

@Entity()
export class MovieUserLike {
    //composite primary key(movieId, userId를 조합했을때 식별되는 유일한 값)
    //그래서 예를들어, userId 컬럼이 1이고 movieId 컬럼이 1인 데이터가 있어도
    //userId 컬럼이 1이고 movieId 컬럼이 2인 데이터를 추가할 수 있다.
    @PrimaryColumn({
        name: 'movieId',
        type: 'int8',
    })
    @ManyToOne(() => Movie, movie => movie.likedUsers, {
        onDelete: 'CASCADE',
    })
    movie: Movie;

    @PrimaryColumn({
        name: 'userId',
        type: 'int8',
    })
    @ManyToOne(() => User, user => user.likedMovies, {
        onDelete: 'CASCADE',
    })
    user: User;

    @Column()
    isLike: boolean;
}
