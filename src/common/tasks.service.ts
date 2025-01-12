import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { readdir, unlink } from 'fs/promises'; //readdir: 디렉토리 내의 모든 파일들을 가져올 수 있다.
import { join, parse } from 'path';
import { Movie } from 'src/movie/entity/movie.entity';
import { Repository } from 'typeorm';
import { DefaultLogger } from './logger/default.logger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class TasksService {
    //private readonly logger = new Logger(TasksService.name);

    /**
     * 가급적으면 TasksService에서 @Cron선언해서 관리하는것이 좋다.
     */

    constructor(
        @InjectRepository(Movie)
        private readonly movieRepository: Repository<Movie>,
        private readonly schedulerRegistry: SchedulerRegistry,
        //private readonly logger: DefaultLogger,
        @Inject(WINSTON_MODULE_NEST_PROVIDER)
        private readonly logger: LoggerService, //winston에서는 기본 출력이 json이다.
    ) {}

    //@Cron('*/5 * * * * *') //초 분 시 일 월 요일
    logEverySecond() {
        //nestJS에서 제공하는 중요도 수, 기준은 프로젝트에 따라 다르다.
        this.logger.fatal('FATAL 레벨 로그', null, TasksService.name); // 지금 당장 해결해야하는 일
        this.logger.error('ERROR 레벨 로그', null, TasksService.name); //실제 에러가 발생했을 때
        this.logger.warn('WARN 레벨 로그', TasksService.name); // 일어나면 안되는 일은 아니지만, 냅둬도 크게 문제 나지 않는 일
        this.logger.log('LOG 레벨 로그', TasksService.name); // 정보성 메시지 보기 위한 로그
        this.logger.debug('DEGUG 레벨 로그', TasksService.name); // 프로덕션 환경X 개발환경에서만 사용
        this.logger.verbose('VERBOSE 레벨 로그', TasksService.name); //중요하지 않는 내용, 개발자가 보기 위한 용도
    }

    //@Cron('* * * * * *') //초 분 시 일 월 요일
    async eraseOrphanedFiles() {
        const files = await readdir(join(process.cwd(), 'public', 'temp'));

        const deleteFilesTargets = files.filter(file => {
            const filename = parse(file).name;

            const split = filename.split('_');

            if (split.length !== 2) {
                return true;
            }

            try {
                const date = +new Date(parseInt(split[split.length - 1]));
                const aDayInMilSec = 24 * 60 * 60 * 1000;

                const now = +Date.now();

                return now - date > aDayInMilSec; //1일이 지났으면 true
            } catch (e) {
                return true;
            }
        });

        await Promise.all(deleteFilesTargets.map(x => unlink(join(process.cwd(), 'public', 'temp', x))));
    }

    //@Cron('0 * * * * *') //1분에 한 번 실행
    async calculateMovieLikeCounts() {
        await this.movieRepository.query(
            `UPDATE movie m 
             SET "likeCount" = (
                SELECT COUNT(*) FROM movie_user_like mul 
                WHERE m.id = mul."movieId"  AND mul."isLike" = true)`,
        );
        await this.movieRepository.query(
            `UPDATE movie m 
             SET "dislikeCount" = (
                SELECT COUNT(*) FROM movie_user_like mul 
                WHERE m.id = mul."movieId"  AND mul."isLike" = false)`,
        );
    }

    // @Cron('* * * * * *', {
    //     name: 'printer',
    // })
    printer() {
        console.log('print every seconds');
    }

    //@Cron('*/5 * * * * *')
    stopper() {
        console.log('---stopper run---');
        const job = this.schedulerRegistry.getCronJob('printer');

        console.log('# Last Date');
        console.log(job.lastDate());
        console.log('# Next Date');
        console.log(job.nextDate());
        // console.log('# next Dates');
        // console.log(job.nextDates(5));

        if (job.running) {
            job.stop(); //printer를 멈추게 함
        } else {
            job.start(); //printer를 다시 시작
        }
    }
}
