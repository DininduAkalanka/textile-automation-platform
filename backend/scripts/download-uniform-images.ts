import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const UNIFORM_IMAGES: { filename: string; url: string }[] = [
  // Healthcare & Hospitality
  {
    filename: 'medical-scrubs.jpg',
    url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80', // Nurse in teal scrubs
  },
  {
    filename: 'doctor-lab-coat.jpg',
    url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80', // Doctor in white lab coat
  },
  {
    filename: 'nurse-tunic-dress.jpg',
    url: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80', // Hospital medical staff
  },
  {
    filename: 'chef-jacket-apron.jpg',
    url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80', // Executive chef in white double-breasted uniform & apron
  },
  {
    filename: 'hospitality-vest.jpg',
    url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80', // Hospitality vest & tie
  },

  // Industrial & Security Workwear
  {
    filename: 'industrial-coverall.jpg',
    url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80', // Worker in heavy duty boiler suit coverall
  },
  {
    filename: 'hivis-safety-jacket.jpg',
    url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80', // Worker in neon safety high-visibility jacket
  },
  {
    filename: 'cargo-work-pants.jpg',
    url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80', // Heavy duty cargo drill work pants
  },
  {
    filename: 'security-duty-shirt.jpg',
    url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80', // Structured navy duty shirt
  },
  {
    filename: 'anti-static-coat.jpg',
    url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80', // Cleanroom dust coat
  },

  // School Uniforms
  {
    filename: 'school-white-shirt.jpg',
    url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80', // School white shirt
  },
  {
    filename: 'school-girls-pinafore.jpg',
    url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80', // School student uniform
  },
  {
    filename: 'school-navy-trousers.jpg',
    url: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=800&q=80', // Navy uniform trousers
  },
  {
    filename: 'private-school-blazer.jpg',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80', // School blazer uniform set
  },
  {
    filename: 'junior-school-shorts.jpg',
    url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80', // Junior uniform
  },

  // Corporate & Office Uniforms
  {
    filename: 'corporate-executive-blazer.jpg',
    url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80', // Corporate executive navy blazer
  },
  {
    filename: 'corporate-office-trouser.jpg',
    url: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=800&q=80', // Tailored office trousers
  },
  {
    filename: 'corporate-oxford-shirt.jpg',
    url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80', // Executive light blue shirt
  },
  {
    filename: 'corporate-pencil-skirt.jpg',
    url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80', // Professional pencil skirt
  },
  {
    filename: 'corporate-waistcoat-vest.jpg',
    url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80', // Executive waistcoat vest
  },
];

const targetDir = path.resolve(__dirname, '../../frontend/public/images/uniforms');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) {
          downloadImage(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log(`📥 Downloading ${UNIFORM_IMAGES.length} authentic uniform photos to ${targetDir}...`);
  for (const item of UNIFORM_IMAGES) {
    const dest = path.join(targetDir, item.filename);
    try {
      await downloadImage(item.url, dest);
      console.log(`✅ Downloaded: ${item.filename}`);
    } catch (err: any) {
      console.error(`❌ Error downloading ${item.filename}:`, err.message);
    }
  }
  console.log('🎉 All uniform images downloaded successfully!');
}

main().catch(console.error);
