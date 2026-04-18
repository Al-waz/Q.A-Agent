import { z } from "zod";
export declare const TestCaseCategorySchema: z.ZodEnum<["factual", "multi-document", "follow-up", "out-of-scope", "ambiguous"]>;
export type TestCaseCategory = z.infer<typeof TestCaseCategorySchema>;
/**
 * A test case can be a single question OR a multi-turn sequence (for follow-up
 * eval). Each turn shares a sessionId so conversation memory is exercised.
 */
export declare const TestCaseTurnSchema: z.ZodObject<{
    question: z.ZodString;
    expectedBehavior: z.ZodString;
    expectedKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    question: string;
    expectedBehavior: string;
    expectedKeywords?: string[] | undefined;
}, {
    question: string;
    expectedBehavior: string;
    expectedKeywords?: string[] | undefined;
}>;
export type TestCaseTurn = z.infer<typeof TestCaseTurnSchema>;
export declare const TestCaseSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<["factual", "multi-document", "follow-up", "out-of-scope", "ambiguous"]>;
    description: z.ZodString;
    turns: z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        expectedBehavior: z.ZodString;
        expectedKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        question: string;
        expectedBehavior: string;
        expectedKeywords?: string[] | undefined;
    }, {
        question: string;
        expectedBehavior: string;
        expectedKeywords?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
    id: string;
    description: string;
    turns: {
        question: string;
        expectedBehavior: string;
        expectedKeywords?: string[] | undefined;
    }[];
}, {
    category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
    id: string;
    description: string;
    turns: {
        question: string;
        expectedBehavior: string;
        expectedKeywords?: string[] | undefined;
    }[];
}>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export declare const JudgeScoreSchema: z.ZodObject<{
    score: z.ZodNumber;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    score: number;
    reasoning: string;
}, {
    score: number;
    reasoning: string;
}>;
export type JudgeScore = z.infer<typeof JudgeScoreSchema>;
export declare const TurnResultSchema: z.ZodObject<{
    turnIndex: z.ZodNumber;
    question: z.ZodString;
    answer: z.ZodString;
    citations: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        sourceTitle: z.ZodString;
        excerpt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }, {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }>, "many">;
    relevance: z.ZodObject<{
        score: z.ZodNumber;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        score: number;
        reasoning: string;
    }, {
        score: number;
        reasoning: string;
    }>;
    groundedness: z.ZodObject<{
        score: z.ZodNumber;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        score: number;
        reasoning: string;
    }, {
        score: number;
        reasoning: string;
    }>;
    citationAccuracy: z.ZodObject<{
        hasCitations: z.ZodBoolean;
        allMarkersResolved: z.ZodBoolean;
        excerptsMatchChunks: z.ZodBoolean;
        score: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        score: number;
        hasCitations: boolean;
        allMarkersResolved: boolean;
        excerptsMatchChunks: boolean;
    }, {
        score: number;
        hasCitations: boolean;
        allMarkersResolved: boolean;
        excerptsMatchChunks: boolean;
    }>;
    latencyMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    citations: {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }[];
    question: string;
    turnIndex: number;
    answer: string;
    relevance: {
        score: number;
        reasoning: string;
    };
    groundedness: {
        score: number;
        reasoning: string;
    };
    citationAccuracy: {
        score: number;
        hasCitations: boolean;
        allMarkersResolved: boolean;
        excerptsMatchChunks: boolean;
    };
    latencyMs: number;
}, {
    citations: {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }[];
    question: string;
    turnIndex: number;
    answer: string;
    relevance: {
        score: number;
        reasoning: string;
    };
    groundedness: {
        score: number;
        reasoning: string;
    };
    citationAccuracy: {
        score: number;
        hasCitations: boolean;
        allMarkersResolved: boolean;
        excerptsMatchChunks: boolean;
    };
    latencyMs: number;
}>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
export declare const TestCaseResultSchema: z.ZodObject<{
    testCase: z.ZodObject<{
        id: z.ZodString;
        category: z.ZodEnum<["factual", "multi-document", "follow-up", "out-of-scope", "ambiguous"]>;
        description: z.ZodString;
        turns: z.ZodArray<z.ZodObject<{
            question: z.ZodString;
            expectedBehavior: z.ZodString;
            expectedKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            question: string;
            expectedBehavior: string;
            expectedKeywords?: string[] | undefined;
        }, {
            question: string;
            expectedBehavior: string;
            expectedKeywords?: string[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
        id: string;
        description: string;
        turns: {
            question: string;
            expectedBehavior: string;
            expectedKeywords?: string[] | undefined;
        }[];
    }, {
        category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
        id: string;
        description: string;
        turns: {
            question: string;
            expectedBehavior: string;
            expectedKeywords?: string[] | undefined;
        }[];
    }>;
    turns: z.ZodArray<z.ZodObject<{
        turnIndex: z.ZodNumber;
        question: z.ZodString;
        answer: z.ZodString;
        citations: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            sourceTitle: z.ZodString;
            excerpt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            sourceTitle: string;
            id: number;
            excerpt: string;
        }, {
            sourceTitle: string;
            id: number;
            excerpt: string;
        }>, "many">;
        relevance: z.ZodObject<{
            score: z.ZodNumber;
            reasoning: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            score: number;
            reasoning: string;
        }, {
            score: number;
            reasoning: string;
        }>;
        groundedness: z.ZodObject<{
            score: z.ZodNumber;
            reasoning: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            score: number;
            reasoning: string;
        }, {
            score: number;
            reasoning: string;
        }>;
        citationAccuracy: z.ZodObject<{
            hasCitations: z.ZodBoolean;
            allMarkersResolved: z.ZodBoolean;
            excerptsMatchChunks: z.ZodBoolean;
            score: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            score: number;
            hasCitations: boolean;
            allMarkersResolved: boolean;
            excerptsMatchChunks: boolean;
        }, {
            score: number;
            hasCitations: boolean;
            allMarkersResolved: boolean;
            excerptsMatchChunks: boolean;
        }>;
        latencyMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        citations: {
            sourceTitle: string;
            id: number;
            excerpt: string;
        }[];
        question: string;
        turnIndex: number;
        answer: string;
        relevance: {
            score: number;
            reasoning: string;
        };
        groundedness: {
            score: number;
            reasoning: string;
        };
        citationAccuracy: {
            score: number;
            hasCitations: boolean;
            allMarkersResolved: boolean;
            excerptsMatchChunks: boolean;
        };
        latencyMs: number;
    }, {
        citations: {
            sourceTitle: string;
            id: number;
            excerpt: string;
        }[];
        question: string;
        turnIndex: number;
        answer: string;
        relevance: {
            score: number;
            reasoning: string;
        };
        groundedness: {
            score: number;
            reasoning: string;
        };
        citationAccuracy: {
            score: number;
            hasCitations: boolean;
            allMarkersResolved: boolean;
            excerptsMatchChunks: boolean;
        };
        latencyMs: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    turns: {
        citations: {
            sourceTitle: string;
            id: number;
            excerpt: string;
        }[];
        question: string;
        turnIndex: number;
        answer: string;
        relevance: {
            score: number;
            reasoning: string;
        };
        groundedness: {
            score: number;
            reasoning: string;
        };
        citationAccuracy: {
            score: number;
            hasCitations: boolean;
            allMarkersResolved: boolean;
            excerptsMatchChunks: boolean;
        };
        latencyMs: number;
    }[];
    testCase: {
        category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
        id: string;
        description: string;
        turns: {
            question: string;
            expectedBehavior: string;
            expectedKeywords?: string[] | undefined;
        }[];
    };
}, {
    turns: {
        citations: {
            sourceTitle: string;
            id: number;
            excerpt: string;
        }[];
        question: string;
        turnIndex: number;
        answer: string;
        relevance: {
            score: number;
            reasoning: string;
        };
        groundedness: {
            score: number;
            reasoning: string;
        };
        citationAccuracy: {
            score: number;
            hasCitations: boolean;
            allMarkersResolved: boolean;
            excerptsMatchChunks: boolean;
        };
        latencyMs: number;
    }[];
    testCase: {
        category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
        id: string;
        description: string;
        turns: {
            question: string;
            expectedBehavior: string;
            expectedKeywords?: string[] | undefined;
        }[];
    };
}>;
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;
export declare const EvalRunSchema: z.ZodObject<{
    runId: z.ZodString;
    startedAt: z.ZodString;
    finishedAt: z.ZodString;
    config: z.ZodObject<{
        model: z.ZodString;
        judgeModel: z.ZodString;
        embeddingModel: z.ZodString;
        rerankerEnabled: z.ZodBoolean;
        hybridEnabled: z.ZodBoolean;
        queryRewritingEnabled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        model: string;
        judgeModel: string;
        embeddingModel: string;
        rerankerEnabled: boolean;
        hybridEnabled: boolean;
        queryRewritingEnabled: boolean;
    }, {
        model: string;
        judgeModel: string;
        embeddingModel: string;
        rerankerEnabled: boolean;
        hybridEnabled: boolean;
        queryRewritingEnabled: boolean;
    }>;
    results: z.ZodArray<z.ZodObject<{
        testCase: z.ZodObject<{
            id: z.ZodString;
            category: z.ZodEnum<["factual", "multi-document", "follow-up", "out-of-scope", "ambiguous"]>;
            description: z.ZodString;
            turns: z.ZodArray<z.ZodObject<{
                question: z.ZodString;
                expectedBehavior: z.ZodString;
                expectedKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }, {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
            id: string;
            description: string;
            turns: {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }[];
        }, {
            category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
            id: string;
            description: string;
            turns: {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }[];
        }>;
        turns: z.ZodArray<z.ZodObject<{
            turnIndex: z.ZodNumber;
            question: z.ZodString;
            answer: z.ZodString;
            citations: z.ZodArray<z.ZodObject<{
                id: z.ZodNumber;
                sourceTitle: z.ZodString;
                excerpt: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }, {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }>, "many">;
            relevance: z.ZodObject<{
                score: z.ZodNumber;
                reasoning: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                score: number;
                reasoning: string;
            }, {
                score: number;
                reasoning: string;
            }>;
            groundedness: z.ZodObject<{
                score: z.ZodNumber;
                reasoning: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                score: number;
                reasoning: string;
            }, {
                score: number;
                reasoning: string;
            }>;
            citationAccuracy: z.ZodObject<{
                hasCitations: z.ZodBoolean;
                allMarkersResolved: z.ZodBoolean;
                excerptsMatchChunks: z.ZodBoolean;
                score: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            }, {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            }>;
            latencyMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            citations: {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }[];
            question: string;
            turnIndex: number;
            answer: string;
            relevance: {
                score: number;
                reasoning: string;
            };
            groundedness: {
                score: number;
                reasoning: string;
            };
            citationAccuracy: {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            };
            latencyMs: number;
        }, {
            citations: {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }[];
            question: string;
            turnIndex: number;
            answer: string;
            relevance: {
                score: number;
                reasoning: string;
            };
            groundedness: {
                score: number;
                reasoning: string;
            };
            citationAccuracy: {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            };
            latencyMs: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        turns: {
            citations: {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }[];
            question: string;
            turnIndex: number;
            answer: string;
            relevance: {
                score: number;
                reasoning: string;
            };
            groundedness: {
                score: number;
                reasoning: string;
            };
            citationAccuracy: {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            };
            latencyMs: number;
        }[];
        testCase: {
            category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
            id: string;
            description: string;
            turns: {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }[];
        };
    }, {
        turns: {
            citations: {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }[];
            question: string;
            turnIndex: number;
            answer: string;
            relevance: {
                score: number;
                reasoning: string;
            };
            groundedness: {
                score: number;
                reasoning: string;
            };
            citationAccuracy: {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            };
            latencyMs: number;
        }[];
        testCase: {
            category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
            id: string;
            description: string;
            turns: {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }[];
        };
    }>, "many">;
    summary: z.ZodObject<{
        meanRelevance: z.ZodNumber;
        meanGroundedness: z.ZodNumber;
        meanCitationAccuracy: z.ZodNumber;
        byCategory: z.ZodRecord<z.ZodEnum<["factual", "multi-document", "follow-up", "out-of-scope", "ambiguous"]>, z.ZodObject<{
            count: z.ZodNumber;
            meanRelevance: z.ZodNumber;
            meanGroundedness: z.ZodNumber;
            meanCitationAccuracy: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            meanRelevance: number;
            meanGroundedness: number;
            meanCitationAccuracy: number;
            count: number;
        }, {
            meanRelevance: number;
            meanGroundedness: number;
            meanCitationAccuracy: number;
            count: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        meanRelevance: number;
        meanGroundedness: number;
        meanCitationAccuracy: number;
        byCategory: Partial<Record<"factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous", {
            meanRelevance: number;
            meanGroundedness: number;
            meanCitationAccuracy: number;
            count: number;
        }>>;
    }, {
        meanRelevance: number;
        meanGroundedness: number;
        meanCitationAccuracy: number;
        byCategory: Partial<Record<"factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous", {
            meanRelevance: number;
            meanGroundedness: number;
            meanCitationAccuracy: number;
            count: number;
        }>>;
    }>;
}, "strip", z.ZodTypeAny, {
    runId: string;
    startedAt: string;
    finishedAt: string;
    config: {
        model: string;
        judgeModel: string;
        embeddingModel: string;
        rerankerEnabled: boolean;
        hybridEnabled: boolean;
        queryRewritingEnabled: boolean;
    };
    results: {
        turns: {
            citations: {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }[];
            question: string;
            turnIndex: number;
            answer: string;
            relevance: {
                score: number;
                reasoning: string;
            };
            groundedness: {
                score: number;
                reasoning: string;
            };
            citationAccuracy: {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            };
            latencyMs: number;
        }[];
        testCase: {
            category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
            id: string;
            description: string;
            turns: {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }[];
        };
    }[];
    summary: {
        meanRelevance: number;
        meanGroundedness: number;
        meanCitationAccuracy: number;
        byCategory: Partial<Record<"factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous", {
            meanRelevance: number;
            meanGroundedness: number;
            meanCitationAccuracy: number;
            count: number;
        }>>;
    };
}, {
    runId: string;
    startedAt: string;
    finishedAt: string;
    config: {
        model: string;
        judgeModel: string;
        embeddingModel: string;
        rerankerEnabled: boolean;
        hybridEnabled: boolean;
        queryRewritingEnabled: boolean;
    };
    results: {
        turns: {
            citations: {
                sourceTitle: string;
                id: number;
                excerpt: string;
            }[];
            question: string;
            turnIndex: number;
            answer: string;
            relevance: {
                score: number;
                reasoning: string;
            };
            groundedness: {
                score: number;
                reasoning: string;
            };
            citationAccuracy: {
                score: number;
                hasCitations: boolean;
                allMarkersResolved: boolean;
                excerptsMatchChunks: boolean;
            };
            latencyMs: number;
        }[];
        testCase: {
            category: "factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous";
            id: string;
            description: string;
            turns: {
                question: string;
                expectedBehavior: string;
                expectedKeywords?: string[] | undefined;
            }[];
        };
    }[];
    summary: {
        meanRelevance: number;
        meanGroundedness: number;
        meanCitationAccuracy: number;
        byCategory: Partial<Record<"factual" | "multi-document" | "follow-up" | "out-of-scope" | "ambiguous", {
            meanRelevance: number;
            meanGroundedness: number;
            meanCitationAccuracy: number;
            count: number;
        }>>;
    };
}>;
export type EvalRun = z.infer<typeof EvalRunSchema>;
//# sourceMappingURL=eval.schema.d.ts.map