import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  isString,
  IsString,
} from 'class-validator';

export class CursorPaginationDto {
  @IsString()
  @IsOptional()
  //id?: number;
  //id_52, likeCount_20
  cursor?: string;

  @IsArray()
  @IsString({
    each: true,
  })
  //ex [id_DESC, likeCount_DESC]
  order: string[] = [];

  @IsInt()
  @IsOptional()
  take: number = 5;
}
