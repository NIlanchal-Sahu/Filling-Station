import { Controller, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  @Post('presign')
  presign(@Body() body: { filename: string; contentType: string; folder?: string }) {
    const key = `${body.folder || 'uploads'}/${uuidv4()}-${body.filename}`;
    const bucket = process.env.AWS_S3_BUCKET || 'localjob-uploads';
    const region = process.env.AWS_REGION || 'ap-south-1';

    // In production: use @aws-sdk/client-s3 getSignedUrl
    return {
      uploadUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}?presigned=true`,
      fileUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      key,
      expiresIn: 3600,
    };
  }
}
