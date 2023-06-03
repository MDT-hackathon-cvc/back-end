import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FindEventDto } from './dto/admin/find-event';
import { EventsAdminService } from './events.admin.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CreateEventDto } from './dto/admin/create-event.dto';
import { UpdateEventDto } from './dto/admin/update-event.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/auth/roles.decorator';
import { ParseObjectIdPipe } from 'src/common/pipe/parse-objectid.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetMintedTokenByEventId } from './dto/admin/get-minted-token-by-event-id';
import { AdminPermissions, UserRole } from 'src/schemas/User.schema';
import { CommonService } from './../common-service/common.service';
import { UpdateTransactionDto } from 'src/transactions/dto/user/update-transaction.dto';
import { PermissionGuard } from 'src/auth/permissions.guard';
import { Permissions } from 'src/auth/permissions.decorator';

@Controller('admin/events')
@ApiTags('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class EventsAdminController {
  constructor(
    private readonly eventsAdminService: EventsAdminService,
    private readonly commonService: CommonService,
  ) {}

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.EVENT_MANAGEMENT)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'whitelist', maxCount: 1 },
    ]),
  )
  create(
    @Request() req,
    @Body() createEventDto: CreateEventDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      whitelist?: Express.Multer.File[];
    },
  ) {
    createEventDto.creatorAddress = req.user.address;
    createEventDto.categories = JSON.parse(createEventDto.categoriesJson);
    createEventDto.image = files && files.image && files.image[0];
    createEventDto.whitelist = files && files.whitelist && files.whitelist[0];
    return this.eventsAdminService.create(createEventDto);
  }

  @Get()
  findAll(@Query() requestData: FindEventDto) {
    return this.eventsAdminService.findAll(requestData);
  }

  @Get(':id')
  findOne(@Param('id', new ParseObjectIdPipe()) id: string) {
    return this.eventsAdminService.findOne(id);
  }

  @Get(':id/mintedToken')
  findMintedTokenByEventId(
    @Param('id', new ParseObjectIdPipe()) id: string,
    @Query() requestData: GetMintedTokenByEventId,
  ) {
    return this.eventsAdminService.getMintedTokenByEventId(id, requestData);
  }

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.EVENT_MANAGEMENT)
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'whitelist', maxCount: 1 },
    ]),
  )
  update(
    @Request() req,
    @Param('id', new ParseObjectIdPipe()) id: string,
    @Body() updateEventDto: UpdateEventDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      whitelist?: Express.Multer.File[];
    },
  ) {
    updateEventDto.creatorAddress = req.user.address;
    updateEventDto.categories = JSON.parse(updateEventDto.categoriesJson);
    updateEventDto.image = files && files.image && files.image[0];
    updateEventDto.whitelist = files && files.whitelist && files.whitelist[0];
    if (!updateEventDto.description) {
      updateEventDto.description = '';
    }
    return this.eventsAdminService.update(id, updateEventDto);
  }

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.EVENT_MANAGEMENT)
  @Patch(':id/launch')
  launch(@Param('id', new ParseObjectIdPipe()) id: string) {
    return this.eventsAdminService.launch(id);
  }

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.EVENT_MANAGEMENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsAdminService.remove(id);
  }

  // @Patch(':id/cancel')
  // cancelEventSuccess(
  //   @Param('id', new ParseObjectIdPipe()) id: string,
  //   @Body() requestDto: UpdateTransactionDto,
  // ) {
  //   return this.commonService.cancelEvent(id, requestDto);
  // }
}
