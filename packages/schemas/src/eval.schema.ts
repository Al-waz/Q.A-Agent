import { z } from "zod";
import { CitationSchema } from "./citation.schema.js";

export const TestCaseCategorySchema = z.enum([
  "factual",
  "multi-document",
  "follow-up",
  "out-of-scope",
  "ambiguous",
]);
export type TestCaseCategory = z.infer<typeof TestCaseCategorySchema>;

/**
 * A test case can be a single question OR a multi-turn sequence (for follow-up
 * eval). Each turn shares a sessionId so conversation memory is exercised.
 */
export const TestCaseTurnSchema = z.object({
  question: z.string(),
  expectedBehavior: z.string().describe("What the agent should do (refuse, cite, synthesize, etc.)"),
  expectedKeywords: z.array(z.string()).optional(),
});
export type TestCaseTurn = z.infer<typeof TestCaseTurnSchema>;

export const TestCaseSchema = z.object({
  id: z.string(),
  category: TestCaseCategorySchema,
  description: z.string(),
  turns: z.array(TestCaseTurnSchema).min(1),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const JudgeScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  reasoning: z.string(),
});
export type JudgeScore = z.infer<typeof JudgeScoreSchema>;

export const TurnResultSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  question: z.string(),
  answer: z.string(),
  citations: z.array(CitationSchema),
  relevance: JudgeScoreSchema,
  groundedness: JudgeScoreSchema,
  citationAccuracy: z.object({
    hasCitations: z.boolean(),
    allMarkersResolved: z.boolean(),
    excerptsMatchChunks: z.boolean(),
    score: z.number().min(0).max(1),
  }),
  latencyMs: z.number().nonnegative(),
});
export type TurnResult = z.infer<typeof TurnResultSchema>;

export const TestCaseResultSchema = z.object({
  testCase: TestCaseSchema,
  turns: z.array(TurnResultSchema),
});
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

export const EvalRunSchema = z.object({
  runId: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  config: z.object({
    model: z.string(),
    judgeModel: z.string(),
    embeddingModel: z.string(),
    rerankerEnabled: z.boolean(),
    hybridEnabled: z.boolean(),
    queryRewritingEnabled: z.boolean(),
  }),
  results: z.array(TestCaseResultSchema),
  summary: z.object({
    meanRelevance: z.number(),
    meanGroundedness: z.number(),
    meanCitationAccuracy: z.number(),
    byCategory: z.record(
      TestCaseCategorySchema,
      z.object({
        count: z.number(),
        meanRelevance: z.number(),
        meanGroundedness: z.number(),
        meanCitationAccuracy: z.number(),
      }),
    ),
  }),
});
export type EvalRun = z.infer<typeof EvalRunSchema>;
