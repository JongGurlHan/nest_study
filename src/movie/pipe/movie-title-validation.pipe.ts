import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class MovieTitleValidationPipe implements PipeTransform<string, string> {
  //<들어갈 값, 반환할 값>
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      return value;
    }

    /// 만약에 글자 길이가 2보다 작거나 같으면 에러 던지기!
    if (value.length <= 2) {
      throw new BadRequestException('영화의 제목은 3자 이상 작성해주세요!');
    }

    return value; //번환하고 싶으면 변환할 수도 있따. ex) value+"변환완료!"
  }
}
