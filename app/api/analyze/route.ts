export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Install: npm install @google/generative-ai

export async function POST(request: NextRequest) {
  try {
    // Pengecekan sisi server - API key akan muncul di terminal server, bukan browser console
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
    console.log('Full API key (first 10 chars):', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'undefined');
    
    // Validasi apakah API key tersedia
    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Ekstrak form data dari request
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    
    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'No image file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Konversi File ke buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Encode ke base64
    const imageBase64 = buffer.toString('base64');
    
    // Validasi format file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, and WebP are supported.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Inisialisasi Google Generative AI dengan API key dari environment
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
    
    // Definisikan konten untuk dikirim ke model
    const prompt = "Analyze this image and provide insights. If it's a food image, identify the food and estimate its nutritional value. If it's exercise or fitness-related, provide relevant feedback.";
    
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: imageFile.type,
      },
    };
    
    // Generate konten
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // Return hasil sebagai JSON
    return new Response(
      JSON.stringify({ success: true, analysis: text }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in Gemini API call:', error);
    
    // Jika error terkait API key, beri pesan khusus
    if (error instanceof Error && error.message.includes('API key')) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}