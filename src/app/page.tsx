
"use client";

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { extractTextFromScans } from '@/ai/flows/extract-text-from-scans';
import { scoreSimilarity } from '@/ai/flows/score-similarity';
import { generateAiFeedback } from '@/ai/flows/generate-feedback';
import { extractQuestionsFromPaper, QuestionDetail } from '@/ai/flows/extract-questions-from-paper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { GradeWiseLogo } from '@/components/icons';
import { AlertCircle, FileText, Upload, Sparkles, ClipboardEdit, ArrowRight, BookCheck, ThumbsUp, Loader2, FileQuestion, PencilRuler, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'initial' | 'analyzing' | 'questions_ready' | 'grading' | 'review';

export default function Home() {
  const [step, setStep] = useState<Step>('initial');
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [questionFilePreview, setQuestionFilePreview] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  
  const [extractedQuestions, setExtractedQuestions] = useState<QuestionDetail[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionDetail | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'student' | 'question') => {
    const file = e.target.files?.[0];
    if (file) {
      if (fileType === 'question') {
        setQuestionFile(file);
        setQuestionFilePreview(URL.createObjectURL(file));
      } else {
        setStudentFile(file);
        setStudentFilePreview(URL.createObjectURL(file));
      }
      setError(null);
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

  const handleAnalyzePaper = useCallback(async () => {
    if (!questionFile) {
      setError('Please upload a question paper to analyze.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setStep('analyzing');
    setLoadingMessage('Analyzing question paper... This may take a moment.');

    try {
      const dataUri = await readFileAsDataURL(questionFile);
      const result = await extractQuestionsFromPaper({ questionPaperDataUri: dataUri, subject });
      
      if (result.questions && result.questions.length > 0) {
        setExtractedQuestions(result.questions);
        setStep('questions_ready');
      } else {
        setError('Could not find any questions in the uploaded document. Please try another file.');
        setStep('initial');
      }
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred during analysis.';
      setError(errorMessage);
      setStep('initial');
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [questionFile, subject, toast]);

  const handleGrade = useCallback(async () => {
    if (!activeQuestion || !studentFile) {
      setError('Please select a question and upload a student answer sheet.');
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
      
      const rubricString = `Keywords: ${activeQuestion.rubric.keywords.join(', ')}`;

      setLoadingMessage('Scoring similarity and generating feedback...');
      const [scoreResult, feedbackResult] = await Promise.all([
        scoreSimilarity({ studentAnswer: extractedText, modelAnswer: activeQuestion.modelAnswer, question: activeQuestion.questionText, rubric: rubricString }),
        generateAiFeedback({ studentAnswer: extractedText, modelAnswer: activeQuestion.modelAnswer, question: activeQuestion.questionText, rubric: rubricString }),
      ]);
      
      setSimilarityScore(scoreResult.similarityScore);
      setJustification(scoreResult.justification);
      setAiFeedback(feedbackResult.feedback);

      setFinalScore(Math.round(scoreResult.similarityScore * activeQuestion.maxMarks));
      setFinalFeedback(feedbackResult.feedback);

      setStep('review');
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred during the grading process.';
      setError(errorMessage);
      setStep('questions_ready');
      toast({
        variant: 'destructive',
        title: 'Grading Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [activeQuestion, studentFile, toast]);

  const handleSelectQuestionForGrading = (question: QuestionDetail) => {
    setActiveQuestion(question);
    // Reset student-specific fields
    setStudentFile(null);
    if(studentFilePreview) URL.revokeObjectURL(studentFilePreview);
    setStudentFilePreview(null);
  };
  
  const handleReset = () => {
    setStep('initial');
    setQuestionFile(null);
    if (questionFilePreview) URL.revokeObjectURL(questionFilePreview);
    setQuestionFilePreview(null);
    setSubject('');
    setExtractedQuestions([]);
    setActiveQuestion(null);
    setStudentFile(null);
    if (studentFilePreview) URL.revokeObjectURL(studentFilePreview);
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
    <div className="max-w-xl mx-auto">
      <Card className="shadow-2xl shadow-primary/10">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <BookCheck className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Analyze Question Paper</CardTitle>
          <CardDescription>Upload a question paper to automatically extract questions and generate model answers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="subject" className="font-semibold text-foreground flex items-center gap-2">
              <PencilRuler className="w-5 h-5 text-primary" /> Subject/Course Name (Optional)
            </label>
            <Input
              id="subject"
              placeholder="e.g., 'Modern Physics', 'Calculus II'"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-base"
              aria-label="Subject or Course Name"
            />
            <p className="text-xs text-muted-foreground">Providing a subject helps the AI generate more accurate answers.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="question-paper-upload" className="font-semibold text-foreground flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Question Paper</label>
            <div className="relative">
              <Input id="question-paper-upload" type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'question')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Question Paper Upload" />
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-background hover:border-primary transition-colors">
                {questionFilePreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <Image src={questionFilePreview} alt="Preview" width={100} height={100} className="rounded-md object-contain max-h-[100px]" data-ai-hint="document scan" />
                    <p className="text-sm text-muted-foreground">{questionFile?.name}</p>
                    <span className="text-xs text-green-600">File selected. Click to change.</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="w-8 h-8" />
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
          <Button size="lg" className="w-full text-lg" disabled={!questionFile || isLoading} onClick={handleAnalyzePaper}>
            <Bot className="mr-2 h-5 w-5" />
            Analyze Paper
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  const renderAnalyzingStep = () => (
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
  
  const renderQuestionsReadyStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:sticky lg:top-24">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline">Extracted Questions</CardTitle>
                    <CardDescription>Select a question to start grading.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full max-h-[60vh] overflow-y-auto pr-2">
                        {extractedQuestions.map((q) => (
                            <AccordionItem value={q.questionId} key={q.questionId}>
                                <AccordionTrigger
                                  className={cn("text-left hover:no-underline", activeQuestion?.questionId === q.questionId && "bg-primary/10 rounded px-2")}
                                  onClick={() => handleSelectQuestionForGrading(q)}
                                >
                                    <div className="flex-1 flex justify-between items-start gap-4">
                                      <span className="font-semibold">{q.questionId}: {q.questionText}</span>
                                      <Badge variant="secondary">{q.maxMarks} Marks</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-2 space-y-4 bg-muted/50 rounded-b-md">
                                    <div>
                                        <h4 className="font-semibold text-sm text-primary">Model Answer</h4>
                                        <p className="text-sm mt-1 whitespace-pre-wrap">{q.modelAnswer}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm text-primary">Grading Keywords</h4>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {q.rubric.keywords.map((kw, i) => <Badge key={i} variant="outline">{kw}</Badge>)}
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
            <Button variant="outline" className="mt-4 w-full" onClick={handleReset}>Analyze Another Paper</Button>
        </div>

        <div>
            {activeQuestion ? (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline">Grade Student Answer for {activeQuestion.questionId}</CardTitle>
                        <CardDescription>{activeQuestion.questionText}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="student-sheet-upload" className="font-semibold text-foreground flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Student Answer Sheet</label>
                            <div className="relative">
                                <Input id="student-sheet-upload" type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'student')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Student Answer Sheet Upload" />
                                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-background hover:border-primary transition-colors">
                                    {studentFilePreview ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Image src={studentFilePreview} alt="Preview" width={100} height={100} className="rounded-md object-contain max-h-[100px]" data-ai-hint="answer sheet" />
                                            <p className="text-sm text-muted-foreground">{studentFile?.name}</p>
                                            <span className="text-xs text-green-600">File selected. Click to change.</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Upload className="w-8 h-8" />
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
                        <Button size="lg" className="w-full text-lg" disabled={!studentFile || isLoading} onClick={handleGrade}>
                            Start Grading <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </CardFooter>
                </Card>
            ) : (
                <Card className="text-center p-8 border-dashed shadow-none">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileQuestion className="w-12 h-12" />
                        <h3 className="text-lg font-semibold mt-4">Select a Question</h3>
                        <p>Choose a question from the list on the left to begin the grading process.</p>
                    </div>
                </Card>
            )}
        </div>
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
            <CardTitle className="font-headline">Question & Model Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm">Q: {activeQuestion?.questionText}</h4>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-primary">Model Answer</h4>
              <p className="text-muted-foreground whitespace-pre-wrap mt-1">{activeQuestion?.modelAnswer}</p>
            </div>
            {activeQuestion?.rubric?.keywords && (
              <div>
                <h4 className="font-semibold text-sm text-primary">Keywords</h4>
                 <div className="flex flex-wrap gap-2 mt-2">
                    {activeQuestion.rubric.keywords.map((kw, i) => <Badge key={i} variant="outline">{kw}</Badge>)}
                </div>
              </div>
            )}
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

      <div className="space-y-6 lg:sticky lg:top-24">
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><Sparkles className="text-primary"/> AI Analysis</CardTitle>
            <CardDescription>Automated scoring and feedback suggestions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="font-semibold text-sm">Similarity to Model Answer: {Math.round((similarityScore || 0) * 100)}%</label>
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
              <label htmlFor="final-score" className="font-semibold">Final Score (/{activeQuestion?.maxMarks})</label>
              <Input
                id="final-score"
                type="number"
                value={finalScore}
                onChange={(e) => setFinalScore(parseInt(e.target.value, 10))}
                max={activeQuestion?.maxMarks}
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
            <Button size="lg" className="w-full" onClick={() => {
              toast({ title: "Grade Saved!", description: "The student's grade has been finalized.", className: "bg-green-600 text-white" });
              setStep('questions_ready');
              setActiveQuestion(null);
            }}>
              <ThumbsUp className="mr-2 h-5 w-5" /> Save and Finish
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => setStep('questions_ready')}>
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
      case 'analyzing':
        return renderAnalyzingStep();
      case 'questions_ready':
        return renderQuestionsReadyStep();
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
      <main className="container mx-auto p-4 md:p-8 flex-grow">
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
