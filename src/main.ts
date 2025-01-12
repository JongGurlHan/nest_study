import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    try {
        const app = await NestFactory.create(AppModule, {
            logger: ['verbose'], //로그 레벨, verbose 위의레벨 까지 보이게 된다.
        });
        const config = new DocumentBuilder()
            .setTitle('넷플릭스 프로젝트')
            .setDescription('nestjs  강의')
            .setVersion('1.0') //문서의 버전
            .build();

        const document = SwaggerModule.createDocument(app, config);

        SwaggerModule.setup('doc', app, document);

        // app.enableVersioning({
        //     type: VersioningType.URI,
        //     // type: VersioningType.HEADER,
        //     // heaer: 'version'
        // });
        app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transformOptions: {
                    enableImplicitConversion: true, //dto에 적혀있는 타입스크립트 타입을 기반으로 입력하는 값을 변경ex) Paginationdto: 프론트에서 string으로 들어오더라도 number로 바꿈
                },
            }),
        );
        app.enableCors(); // 예: CORS 설정
        await app.listen(3000);
    } catch (error) {
        console.error('Application failed to start:', error);
        process.exit(1); // 필요한 경우 프로세스 종료
    }
}
bootstrap();
