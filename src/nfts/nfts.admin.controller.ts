import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateNftDto } from './dto/admin/create-nft.dto';
// import { Role } from 'src/auth/role.enum';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminPermissions, UserRole } from 'src/schemas/User.schema';
import { FindNftDto } from './dto/admin/find-nft.dto';
import { FindOwnerDto } from './dto/admin/find-owner.dto';
import { FindTransactionDto } from './dto/admin/find-transaction.dto';
import { NftsAdminService } from './nfts.admin.service';
import { SearchDto } from 'src/common/search.dto';
import { AddSupplyNftDto } from './dto/admin/add-supply-nft.dto';
import { GetAllTokenDto } from './dto/admin/get-all-token.dto';
import { PermissionGuard } from 'src/auth/permissions.guard';
import { Permissions } from 'src/auth/permissions.decorator';

@ApiTags('admin/nfts')
@Controller('admin/nfts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class NftsAdminController {
  constructor(private readonly nftsService: NftsAdminService) {}

  @Get()
  findAll(@Query() requestData: FindNftDto) {
    return this.nftsService.findAll(requestData);
  }

  @UseGuards(PermissionGuard)
  @Permissions(AdminPermissions.NFT_MANAGEMENT)
  @Post(':id/supply')
  addSupplyNft(@Param('id') id: string, @Body() requestData: AddSupplyNftDto) {
    return this.nftsService.addSupplyNft(id, requestData);
  }

  @Get('tokenId/:tokenId')
  async getDetailTokenId(@Param('tokenId') tokenId: string) {
    return this.nftsService.getDetailTokenId(tokenId);
  }

  @Post('createNftTest')
  createNftTest() {
    return this.nftsService.createNftTest();
  }
}
