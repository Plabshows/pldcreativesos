import {NextResponse} from 'next/server';
import {requireOrganization} from '@/lib/server/auth';
import {randomUUID} from 'node:crypto';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const auth = await requireOrganization();
  if ('error' in auth) return auth.error;
  const {supabase, membership} = auth;
  const orgId = membership.organization_id;

  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({error: 'Formulario no válido.'}, {status: 400});

    const file = formData.get('file');
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({error: 'Selecciona una imagen válida.'}, {status: 400});
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({error: 'La imagen debe pesar menos de 10 MB.'}, {status: 400});
    }

    const mime = file.type || '';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({error: 'El archivo debe ser una imagen (JPG, PNG, WEBP, etc.).'}, {status: 400});
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = file.name.slice((file.name.lastIndexOf('.') - 1 >>> 0) + 2) || 'jpg';
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
    const storagePath = `${orgId}/${randomUUID()}_${cleanName}`;

    // Upload to Supabase Storage bucket 'inventory-photos'
    const {error: uploadErr} = await supabase.storage
      .from('inventory-photos')
      .upload(storagePath, bytes, {
        contentType: mime || 'image/jpeg',
        upsert: true,
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      // Fallback: If bucket or storage upload fails, return base64 data URL so user upload never breaks
      const base64 = `data:${mime || 'image/jpeg'};base64,${bytes.toString('base64')}`;
      return NextResponse.json({url: base64});
    }

    const {data: publicUrlData} = supabase.storage
      .from('inventory-photos')
      .getPublicUrl(storagePath);

    return NextResponse.json({url: publicUrlData.publicUrl});
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({error: 'No se pudo subir la foto. Inténtalo de nuevo.'}, {status: 500});
  }
}
