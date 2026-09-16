import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { DocumentsService } from './documents.service';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { UserIdentity } from '../common/types';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('api/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Download document by query ID (?id=...)' })
  @ApiQuery({ name: 'id', required: true })
  async downloadByQuery(
    @CurrentUser() user: UserIdentity,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    if (!id) throw new BadRequestException('Document ID is required.');
    const { stream, metadata } = await this.documentsService.getDocument(user, id);

    res.setHeader('Content-Type', metadata.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    stream.pipe(res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download document by path ID (/:id)' })
  async downloadByPath(
    @CurrentUser() user: UserIdentity,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, metadata } = await this.documentsService.getDocument(user, id);

    res.setHeader('Content-Type', metadata.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    stream.pipe(res);
  }

  @Post()
  @ApiOperation({ summary: 'Upload document (raw stream or multipart)' })
  @ApiQuery({ name: 'application', required: true })
  @ApiQuery({ name: 'kind', required: true })
  @ApiQuery({ name: 'name', required: false })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: UserIdentity,
    @Query('application') queryApp: string,
    @Query('kind') queryKind: string,
    @Query('name') queryName: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    let application = queryApp || (req.body && req.body.application);
    let kind = queryKind || (req.body && req.body.kind);
    let filename = queryName;
    let buffer: Buffer;
    let contentType = req.headers['content-type'];

    if (file) {
      filename = queryName || file.originalname || 'document';
      buffer = file.buffer;
      contentType = file.mimetype || contentType;
    } else if (req.body instanceof Buffer) {
      buffer = req.body;
      filename = (queryName || 'document').slice(0, 200);
    } else if (typeof req.body === 'string') {
      buffer = Buffer.from(req.body);
      filename = (queryName || 'document').slice(0, 200);
    } else {
      buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
      filename = (queryName || 'document').slice(0, 200);
    }

    return this.documentsService.uploadDocument(
      user,
      application,
      kind,
      filename,
      buffer,
      contentType,
    );
  }
}
