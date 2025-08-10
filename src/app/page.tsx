"use client";

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { extractTextFromScans } from '@/ai/flows/extract-text-from-scans';
import { scoreSimilarity } from '@/ai/flows/score-similarity';
import { generateAiFeedback } from '@/ai/flows/generate-feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { GradeWiseLogo } from '@/components/icons';
import { AlertCircle, FileText, Upload, Sparkles, ClipboardEdit, ArrowRight, BookCheck, ThumbsUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'initial' | 'grading' | 'review';

export default function Home() {
  const [step, setStep] = useState<Step>('initial');
  const [modelAnswer, setModelAnswer] = useState<string>('');
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentFilePreview, setStudentFilePreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [justification, setJustification] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const [finalScore, setFinalScore] = useState<number>(0);
  const [finalFeedback, setFinalFeedback] = useState<string>('');

  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setStudentFile(file);
      setStudentFilePreview(URL.createObjectURL(file));
      setError(null);
    } else {
      setError('Please upload a valid image file (JPEG, PNG, etc.). PDF support is experimental.');
      setStudentFile(null);
      setStudentFilePreview(null);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleGrade = useCallback(async () => {
    if (!modelAnswer || !studentFile) {
      setError('Please provide a model answer and upload a student answer sheet.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setStep('grading');

    try {
      setLoadingMessage('Preparing answer sheet...');
      const dataUri = await readFileAsDataURL(studentFile);

      setLoadingMessage('Extracting text from scan...');
      const { extractedText } = await extractTextFromScans({ scanDataUri: dataUri });
      setExtractedText(extractedText);
      
      setLoadingMessage('Scoring similarity and generating feedback...');
      const [scoreResult, feedbackResult] = await Promise.all([
        scoreSimilarity({ studentAnswer: extractedText, modelAnswer }),
        generateAiFeedback({ studentAnswer: extractedText, modelAnswer }),
      ]);
      
      setSimilarityScore(scoreResult.similarityScore);
      setJustification(scoreResult.justification);
      setAiFeedback(feedbackResult.feedback);

      setFinalScore(Math.round(scoreResult.similarityScore * 100));
      setFinalFeedback(feedbackResult.feedback);

      setStep('review');
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred during the grading process.';
      setError(errorMessage);
      setStep('initial');
      toast({
        variant: 'destructive',
        title: 'Grading Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [modelAnswer, studentFile, toast]);

  const handleReset = () => {
    setStep('initial');
    setModelAnswer('');
    setStudentFile(null);
    if (studentFilePreview) {
      URL.revokeObjectURL(studentFilePreview);
    }
    setStudentFilePreview(null);
    setError(null);
    setExtractedText(null);
    setSimilarityScore(null);
    setJustification(null);
    setAiFeedback(null);
    setFinalScore(0);
    setFinalFeedback('');
  };

  const renderInitialStep = () => (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-2xl shadow-primary/10">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
             <BookCheck className="w-12 h-12 text-primary"/>
          </div>
          <CardTitle className="text-3xl font-headline">Start a New Grading Session</CardTitle>
          <CardDescription>Provide the model answer and the student's sheet to begin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="model-answer" className="font-semibold text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Model Answer</label>
            <Textarea
              id="model-answer"
              placeholder="Enter the ideal answer for the question..."
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              className="min-h-[120px] text-base"
              aria-label="Model Answer"
            />
          </div>
          <div className="space-y-2">
             <label htmlFor="student-sheet" className="font-semibold text-foreground flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Student Answer Sheet</label>
             <div className="relative">
                <Input id="student-sheet" type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Student Answer Sheet Upload"/>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-background hover:border-primary transition-colors">
                    {studentFilePreview ? (
                        <div className="flex flex-col items-center gap-2">
                          <Image src={studentFilePreview} alt="Preview" width={100} height={100} className="rounded-md object-contain max-h-[100px]" data-ai-hint="document scan" />
                          <p className="text-sm text-muted-foreground">{studentFile?.name}</p>
                          <span className="text-xs text-green-600">File selected. Click to change.</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Upload className="w-8 h-8"/>
                            <p>Click to browse or drag & drop</p>
                            <p className="text-xs">PNG, JPG, or PDF</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full text-lg" disabled={!modelAnswer || !studentFile || isLoading} onClick={handleGrade}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Grading...
              </>
            ) : (
              <>
                Start Grading <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  const renderGradingStep = () => (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="w-16 h-16 animate-spin text-primary" />
      <h2 className="text-2xl font-semibold font-headline">AI is at work...</h2>
      <p className="text-muted-foreground">{loadingMessage}</p>
      <div className="w-full max-w-md mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-2" />
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Student's Answer Sheet</CardTitle>
          </CardHeader>
          <CardContent>
            {studentFilePreview && <Image src={studentFilePreview} alt="Student's answer sheet" width={800} height={1100} className="rounded-md border shadow-sm w-full" data-ai-hint="answer sheet"/>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Model Answer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{modelAnswer}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Extracted Text</CardTitle>
            <CardDescription>Text extracted from the scan by AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground p-4 bg-muted/50 rounded-md whitespace-pre-wrap">{extractedText || "No text extracted."}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><Sparkles className="text-primary"/> AI Analysis</CardTitle>
            <CardDescription>Automated scoring and feedback suggestions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="font-semibold text-sm">Similarity Score: {Math.round((similarityScore || 0) * 100)}%</label>
              <Slider
                value={[ (similarityScore || 0) * 100 ]}
                max={100}
                step={1}
                className={cn('my-2', (similarityScore || 0) > 0.7 ? '[&>div>span]:bg-green-500' : (similarityScore || 0) > 0.4 ? '[&>div>span]:bg-yellow-500' : '[&>div>span]:bg-red-500')}
                disabled
              />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Justification</h4>
              <p className="text-sm text-muted-foreground mt-1">{justification}</p>
            </div>
             <div>
              <h4 className="font-semibold text-sm">Suggested Feedback</h4>
              <p className="text-sm text-muted-foreground mt-1">{aiFeedback}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><ClipboardEdit className="text-primary"/> Final Grade & Feedback</CardTitle>
            <CardDescription>Review and override the final grade and feedback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="final-score" className="font-semibold">Final Score (/100)</label>
              <Input
                id="final-score"
                type="number"
                value={finalScore}
                onChange={(e) => setFinalScore(parseInt(e.target.value, 10))}
                max="100"
                min="0"
                className="text-lg font-bold"
              />
            </div>
             <div className="space-y-2">
              <label htmlFor="final-feedback" className="font-semibold">Final Feedback</label>
              <Textarea
                id="final-feedback"
                value={finalFeedback}
                onChange={(e) => setFinalFeedback(e.target.value)}
                className="min-h-[150px]"
                rows={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2">
            <Button size="lg" className="w-full" onClick={() => toast({ title: "Grade Saved!", description: "The student's grade has been finalized.", className: "bg-green-600 text-white" })}>
              <ThumbsUp className="mr-2 h-5 w-5" /> Save Final Grade
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={handleReset}>
              Grade Another
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
  
  const renderContent = () => {
    switch(step) {
      case 'initial':
        return renderInitialStep();
      case 'grading':
        return renderGradingStep();
      case 'review':
        return renderReviewStep();
      default:
        return renderInitialStep();
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <GradeWiseLogo className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold font-headline text-foreground">
            GradeWise
          </h1>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8 flex-grow flex items-center">
        <div className="w-full transition-all duration-500 ease-in-out">
          {renderContent()}
        </div>
      </main>
      <footer className="p-4 border-t text-center text-sm text-muted-foreground">
        <div className="container mx-auto">
          <p>&copy; {new Date().getFullYear()} GradeWise. An AI-powered grading assistant.</p>
        </div>
      </footer>
    </div>
  );
}
