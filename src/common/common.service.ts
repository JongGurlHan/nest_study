import { BadRequestException, Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { PagePaginationDto } from './dto/page-pagination.dto';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';

@Injectable()
export class CommonService {
  constructor() {}

  applyPagePaginationParamsToQb<T>(
    qb: SelectQueryBuilder<T>,
    dto: PagePaginationDto,
  ) {
    const { page, take } = dto;

    const skip = (page - 1) * take;

    qb.take(take);
    qb.skip(skip);
  }

  async applyCursorPaginationParamsToQb<T>(
    qb: SelectQueryBuilder<T>,
    dto: CursorPaginationDto,
  ) {
    let { cursor, order, take } = dto;

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');

      /**
       * {
       *  values :{
       *    id: 27
       * },
       *  order: ['id_DESC']
       * }
       */
      const cursorObj = JSON.parse(decodedCursor);

      order = cursorObj.order;

      const { values } = cursorObj;

      /// {movie.column1, movie.column2, movie.column3} > {:value1, :value2, :value3}

      const columns = Object.keys(values);
      const comparisonOperator = order.some((o) => o.endsWith('DESC'))
        ? '<'
        : '>';
      const whereConditions = columns.map((c) => `${qb.alias}.${c}`).join(',');
      const whereParams = columns.map((c) => `:${c}`).join(',');

      qb.where(
        `(${whereConditions}) ${comparisonOperator} ${whereParams}`,
        values,
      );
    }
    //["likeCount_DESC", "id_DESC", ]
    for (let i = 0; i < order.length; i++) {
      const [column, directon] = order[i].split('_');

      if (directon !== 'ASC' && directon !== 'DESC') {
        throw new BadRequestException('Order는 ASC 또는 DESC로 입력해주세요!');
      }

      if (i === 0) {
        qb.orderBy(`${qb.alias}.${column}`, directon);
      } else {
        qb.addOrderBy(`${qb.alias}.${column}`, directon);
      }
    }

    qb.take(take);

    const results = await qb.getMany();

    const nextCursor = this.generateNextCursor(results, order);

    return { qb, nextCursor };
  }

  //쿼리를 실행하고 응답받은 데이터리스트를 result에 넣어준다. 마지막 데이터 같고 있어야 하기 때문에
  generateNextCursor<T>(results: T[], order: string[]): string | null {
    if (results.length === 0) return null; //응답값 x: 다음데이터가 없으니까 커서 만들 필요가 없다.

    /**
     * {
     *  values :{
     *    id: 27
     * },
     *  order: ['id_DESC']
     * }
     */
    const lastItem = results[results.length - 1];

    const values = {};
    order.forEach((columnOrder) => {
      const [column] = columnOrder.split('_');
      values[column] = lastItem[column];
    });

    const cursorObj = { values, order };
    const nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString(
      'base64',
    );

    return nextCursor;
  }
}
