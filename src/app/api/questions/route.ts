import { NextRequest, NextResponse } from 'next/server';
import questionsData from '@/data/questions.json';

// Get all questions
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(questionsData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// Get a specific question by ID
export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }
    
    const question = questionsData.find((q: any) => q.id === id);
    
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    
    return NextResponse.json(question);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
  }
}
