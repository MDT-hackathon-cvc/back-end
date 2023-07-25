import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FindEventDto } from './dto/admin/find-event';
import {EventsService } from './events.service';
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
import { PermissionGuard } from 'src/auth/permissions.guard';
import { Permissions } from 'src/auth/permissions.decorator';

@Controller('events')
@ApiTags('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.USER)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
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
    return this.eventsService.create(createEventDto);
  }

  @Get()
  findAll(@Query() requestData: FindEventDto) {
    return this.eventsService.findAll(requestData);
  }

  @Get(':id')
  findOne(@Param('id', new ParseObjectIdPipe()) id: string) {
    return this.eventsService.findOne(id);
  }

  @Get(':id/mintedToken')
  findMintedTokenByEventId(
    @Param('id', new ParseObjectIdPipe()) id: string,
    @Query() requestData: GetMintedTokenByEventId,
  ) {
    return this.eventsService.getMintedTokenByEventId(id, requestData);
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
    return this.eventsService.update(id, updateEventDto);
  }

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.EVENT_MANAGEMENT)
  @Patch(':id/launch')
  launch(@Param('id', new ParseObjectIdPipe()) id: string) {
    return this.eventsService.launch(id);
  }

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.EVENT_MANAGEMENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
