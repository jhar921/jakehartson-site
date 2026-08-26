import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PHOTO_SIZE = 480;

function foldLine(line: string, max = 75): string {
  if (line.length <= max) return line;
  const lines = [line.slice(0, max)];
  let rest = line.slice(max);
  while (rest.length > 0) {
    lines.push(' ' + rest.slice(0, max - 1));
    rest = rest.slice(max - 1);
  }
  return lines.join('\r\n');
}

export const GET: APIRoute = async () => {
  const source = path.join(process.cwd(), 'src/assets/jake-hero.jpg');
  const jpeg = await sharp(await readFile(source))
    .rotate()
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 80, mozjpeg: true, progressive: false })
    .toBuffer();

  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Jake Hartson',
    'N:Hartson;Jake;;;',
    'TITLE:Founder and Strategist',
    'EMAIL;TYPE=INTERNET:jake@jakehartson.com',
    'TEL;TYPE=CELL:+18582912054',
    'URL:https://jakehartson.com',
    'NOTE:Orange County founder and strategist. Strategy, operations, and leadership clarity for marketplace operators.',
    foldLine(`PHOTO;ENCODING=b;TYPE=JPEG:${jpeg.toString('base64')}`),
    'END:VCARD',
    '',
  ].join('\r\n');

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
    },
  });
};
