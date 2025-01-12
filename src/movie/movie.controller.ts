import {
    BadRequestException,
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    Version,
} from '@nestjs/common';
import { MovieService } from './movie.service';
import { MovieTitleValidationPipe } from './pipe/movie-title-validation.pipe';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { AuthGuard } from 'src/auth/guard/auth.guard';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entities/user.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CacheInterceptor } from 'src/common/interceptor/cache.interceptor';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { Request } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MovieFilePipe } from './pipe/movie-file.pipe';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';
import { QueryRunner as QR } from 'typeorm';
import { CacheKey, CacheTTL, CacheInterceptor as CI } from '@nestjs/cache-manager';
import { Throttle } from 'src/common/decorator/throttle.decorator';

@Controller('movie')
@UseInterceptors(ClassSerializerInterceptor)
export class MovieController {
    constructor(private readonly movieService: MovieService) {}

    @Get()
    @Public()
    @Throttle({
        count: 5,
        unit: 'minute',
    })
    @UseInterceptors(CacheInterceptor)
    getMovies(@Query() dto: GetMoviesDto, @UserId() userId?: number) {
        console.log('dto', dto);
        /// title 쿼리의 타입이 string 타입인지?
        return this.movieService.findAll(dto, userId);
    }

    @Get('recent')
    @UseInterceptors(CI) //url을 기반으로 캐싱을 한다. 만약에 쿼리 파라피터를 넣으면 다른 url로 인식한다
    @CacheKey('getMoviesRecent') //캐싱을 할때 키값을 지정해준다.쿼리가 변경되도 같은 키값에 저장된다.
    @CacheTTL(1000) //캐싱 시간 오버라이드 (10초)
    getMoviesRecent() {
        return this.movieService.findRecent();
    }

    @Get(':id')
    @Public()
    getMovie(
        @Param('id', ParseIntPipe) id: number, // ParseIntPipe: 변환해주고 검증까지 해준다.
    ) {
        return this.movieService.findOne(id);
    }

    @Post()
    @RBAC(Role.admin)
    @UseInterceptors(TransactionInterceptor)
    postMovie(@Body() body: CreateMovieDto, @QueryRunner() queryRunner: QR, @UserId() userId: number) {
        return this.movieService.create(body, userId, queryRunner);
    }

    @Patch(':id')
    @RBAC(Role.admin)
    patchMovie(@Param('id', ParseIntPipe) id: string, @Body() body: UpdateMovieDto) {
        return this.movieService.update(+id, body);
    }

    @Delete(':id')
    @RBAC(Role.admin)
    deleteMovie(@Param('id', ParseIntPipe) id: string) {
        return this.movieService.remove(+id);
    }
    /**
     * [Like], [Dislike]
     *
     * 아무것도 누르지 않은 상태
     * LIKE, DISLIKE 모두 버튼 꺼져 있음
     *
     * LIKE 버튼을 누르면
     * LIKE 버튼이 불 켜짐
     *
     * LIKE 버튼을 다시 누르면
     * LIKE 버튼이 꺼짐
     *
     * DISLIKE 버튼을 누르면
     * DISLIKE 버튼이 불 켜짐
     *
     * DISLIKE 버튼을 다시 누르면
     * DISLIKE 버튼이 꺼짐
     *
     * LIKE 버튼 누름
     * LIKE 버튼이 불 켜짐
     *
     * DISLIKE 버튼 누름
     * LIKE 버튼이 꺼지고 DISLIKE 버튼이 불 켜짐
     *
     */
    @Post(':id/like')
    createMovieLike(@Param('id', ParseIntPipe) movieId: number, @UserId() userId: number) {
        return this.movieService.toggleMovieLike(movieId, userId, true);
    }

    @Post(':id/dislike')
    createMovieDislike(@Param('id', ParseIntPipe) movieId: number, @UserId() userId: number) {
        return this.movieService.toggleMovieLike(movieId, userId, false);
    }
}
