import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('common')
export class CommonController {
    @Post('video')
    @UseInterceptors(
        FileInterceptor('video', {
            limits: {
                fieldSize: 2000000,
            },
            fileFilter(req, file, callback) {
                console.log(file);
                if (file.mimetype !== 'video/mp4') {
                    return callback(new BadRequestException('MP4 파일만 업로드 가능합니다!'), false);
                }

                return callback(null, false); //null, false-> 파일을 받지 않음, true: 어떤 조건에서든 파일을 받ㅇ르 수 있음.
            },
        }),
    )
    createVideo(@UploadedFile() movie: Express.Multer.File) {
        console.log('movie', movie);
        return {
            fileName: movie.filename,
        };
    }
}
