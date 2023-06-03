import { ErrorMessage } from './../constants';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ObjectID } from 'bson';
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<any, ObjectID> {
  public transform(value: any): ObjectID {
    try {
      const transformedObjectId: ObjectID = ObjectID.createFromHexString(value);
      return transformedObjectId;
    } catch (error) {
      throw new BadRequestException(ErrorMessage.INVALID_OBJECT_ID);
    }
  }
}
