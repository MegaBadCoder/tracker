import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailNotificationPort } from '../auth/domain/email-notification.port';

@Injectable()
export class EmailService extends EmailNotificationPort {
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT', '465')),
      secure: this.configService.get<string>('SMTP_SECURE', 'true') === 'true',
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
    this.fromAddress = this.configService.get<string>(
      'EMAIL_FROM',
      this.configService.getOrThrow<string>('SMTP_USER'),
    );
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Alfy — код подтверждения',
      html: `<p>Ваш код подтверждения: <strong>${code}</strong></p><p>Код действителен 10 минут.</p>`,
    });

    this.logger.log(`Verification email sent to ${to}, messageId: ${info.messageId}`);
  }
}
