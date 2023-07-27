import { FindTokensCanRedeemDto } from './dto/user/find-tokens-can-redeem.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { NftsService } from './nfts.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Utils } from 'src/common/utils';
import { FindTransactionDto } from './dto/user/find-transaction.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { FindItemOwnerDto } from './dto/user/find-item-owner.dto';
import { UserRole } from 'src/schemas/User.schema';
import { FindNftDto } from './dto/admin/find-nft.dto';
import { CreateNftDto } from './dto/admin/create-nft.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { MintNftDto } from './dto/user/mint-nft.dto';
import { PutOnSaleDto } from './dto/user/put-on-sale.dto';

@ApiTags('nfts')
@Controller('nfts')
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  @Get()
  async findAll(@Query() requestData: FindNftDto) {
    return this.nftsService.findAll(requestData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Get('owner')
  async findOwnerNft(@Request() req) {
    return this.nftsService.findOwnerNft(req.user.address);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.USER)
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.nftsService.findNFTDetailUser(req.user.address, id);
  }

  @Get(':id/transactions')
  async findTransactions(
    @Request() req: Request,
    @Param('id') id: string,
    @Query() requestData: FindTransactionDto,
  ) {
    const user = await Utils.getUser(req);
    return this.nftsService.findTransactions(id, requestData, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Get(':id/owned')
  async findOwned(
    @Request() req,
    @Param('id') id: string,
    @Query() requestData: FindItemOwnerDto,
  ) {
    return this.nftsService.findOwned(req.user, id, requestData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @Post()
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'mediaFile', maxCount: 1 },
    ]),
  )
  create(@Request() req, @Body() requestData: CreateNftDto) {
    return this.nftsService.create(requestData, req.user.address);
  }

  @Post('/ipfs')
  @UseInterceptors(FileInterceptor('file'))
  uploadToIpfs(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.nftsService.uploadsFileToIpfs(file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Put('/mint/:id')
  mintNft(@Request() req, @Body() requestData: MintNftDto, @Param('id') id: string) {
    return this.nftsService.mintNft(id, requestData, req.user.address);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Put('/sale-orders/:id')
  putOnSale(@Request() req, @Body() requestData: PutOnSaleDto, @Param('id') id: string) {
    return this.nftsService.putOnSale(requestData, req.user.address, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Put('/cancel-sale-orders/:id')
  cancelOnSale(@Request() req, @Body() requestData: PutOnSaleDto, @Param('id') id: string) {
    return this.nftsService.cancelOnSale(requestData, req.user.address, id);
  }
}
