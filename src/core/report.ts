import { TextOptionsLight } from 'jspdf';

import {
  DEFAULT_CURRENCY,
  DEFAULT_DATE_FORMAT,
  DEFAULT_LOCALE,
  formatDate,
  formatNamedDate,
  formatMoney,
  totalize,
  uuid
} from './utils';
import { Invoice } from './invoice';
import { Document } from './doc';

const MAX_COL_WIDTH = 68;

export interface ReportOptions {
  referenceMonth: Date;
  dueOn?: Date;
}

class Report {
  #doc;
  #invoice;
  #id?: string;
  #date!: Date;
  #dueOn?: Date;
  #referenceMonth!: Date;

  constructor(invoice: Invoice) {
    this.#doc = new Document();
    this.#invoice = invoice;
  }

  #generateDocumentProperties(title: string) {
    const { supplier } = this.#invoice;
    this.#doc.setTitle(`${title}`).setAuthor(`${supplier?.description}`);
  }

  #generatePropsAndHeaderInfo() {
    const options: TextOptionsLight = { align: 'right' };
    const { configuration } = this.#invoice;
    const title = `INVOICE FOR ${formatDate(this.#date, configuration?.dateFormat || DEFAULT_DATE_FORMAT)}`;
    this.#generateDocumentProperties(title);
    this.#doc.setFont({ weight: 'bold', size: 16 }).setXY(this.#doc.width - 30, 30);
    this.#doc.breakText(title, options);
    this.#doc.setFont({ weight: 'normal', size: 7, color: 100 });
    this.#doc.writeText(`ID: ${this.#id}`, options);
  }

  #generateCompaniesInfo() {
    const { supplier, customer } = this.#invoice;
    const options = { maxWidth: MAX_COL_WIDTH };

    this.#doc.setFont({ weight: 'bold', size: 9 }).setXY(30, 60);
    this.#doc.breakText('SUPPLIER').breakText();
    this.#doc.breakText(supplier?.description, options);
    this.#doc.setFont({ weight: 'normal' });
    this.#doc.breakText(supplier?.address, options);

    this.#doc.setFont({ weight: 'bold' }).setXY(110, 60);
    this.#doc.breakText('CUSTOMER').breakText();
    this.#doc.breakText(customer?.description, options);
    this.#doc.setFont({ weight: 'normal' });
    this.#doc.breakText(customer?.address, options);
  }

  #generateBanksInfo() {
    const { intermediaryBank, bank, beneficiary } = this.#invoice;
    const options = { maxWidth: MAX_COL_WIDTH };

    this.#doc.setFont({ weight: 'bold' }).setXY(30, 90);
    if (intermediaryBank?.info) {
      this.#doc.breakText('INTERMEDIARY BANK').breakText();
      this.#doc.setFont({ weight: 'normal' });
      this.#doc.breakText(intermediaryBank?.info, options);
      this.#doc.setFont({ weight: 'bold' }).breakText();
    }

    this.#doc.breakText('BANK').breakText();
    this.#doc.setFont({ weight: 'normal' });
    this.#doc.breakText(bank?.info, options);

    this.#doc.setFont({ weight: 'bold' }).breakText();
    this.#doc.breakText('BENEFICIARY').breakText();
    this.#doc.setFont({ weight: 'normal' });
    this.#doc.breakText(beneficiary?.name);
    if (beneficiary?.iban) {
      this.#doc.breakText(`IBAN: ${beneficiary.iban}`);
    }
    this.#doc.breakText();
  }

  #generateServiceInfo() {
    const { services, configuration } = this.#invoice;
    const locale = configuration?.locale || DEFAULT_LOCALE;
    const currency = configuration?.currency || DEFAULT_CURRENCY;
    const options = { align: 'right' };
    const year = new Date().getFullYear();
    this.#doc.setFont({ weight: 'bold' }).breakText();
    this.#doc.breakText('SERVICES').breakText();
    this.#doc.setFont({ weight: 'normal' });
    services?.forEach((service) => {
      if (this.#doc.getXY().y > this.#doc.height - 30) {
        this.#doc.newPage();
      }
      const { x, y } = this.#doc.getXY();
      this.#doc.writeText(service?.description || '');
      this.#doc
        .setXY(this.#doc.width - 30)
        .breakText(formatMoney(service?.value || 0, '', locale), options)
        .setXY(x, y + 1)
        .writeLine({ dotted: true, width: 0.1 });
    });

    this.#doc.setFont({ weight: 'bold' }).setXY(30).breakText();
    this.#doc.breakText('TOTAL');
    this.#doc.writeLine();
    this.#doc.setFont({ weight: 'bold', size: 10 }).setXY(this.#doc.width - this.#doc.getXY().x);
    this.#doc.breakText(
      formatMoney(
        totalize(this.#invoice?.services, 'value'),
        this.#invoice?.configuration?.currency,
        this.#invoice?.configuration?.locale
      ),
      options
    );
  }

  #generateDatesInfo() {
    const { configuration } = this.#invoice;
    const locale = configuration?.locale || DEFAULT_LOCALE;
    const options: TextOptionsLight = { align: 'right' };

    this.#doc
      .focusPage(1)
      .setFont({ weight: 'normal' })
      .setXY(126, this.#doc.height / 2 - 40);
    this.#doc.writeText('Issued on:', options);
    this.#doc.setXY(150);
    this.#doc.breakText(formatNamedDate(this.#date, locale), options);

    if (this.#dueOn) {
      this.#doc.setXY(126);
      this.#doc.writeText('Due on:', options);
      this.#doc.setXY(150);
      this.#doc.breakText(formatNamedDate(this.#dueOn, locale), options);
    }
  }

  async generate({ referenceMonth, dueOn }: ReportOptions): Promise<chrome.downloads.DownloadOptions> {
    this.#id = uuid();
    this.#date = new Date();
    this.#referenceMonth = referenceMonth;
    this.#dueOn = dueOn;

    this.#generatePropsAndHeaderInfo();
    this.#generateCompaniesInfo();
    this.#generateBanksInfo();
    this.#generateServiceInfo();
    this.#generateDatesInfo();

    return { url: await this.#doc.data(), filename: `Invoice-${this.#id}.pdf` };
  }
}

export { Report };
