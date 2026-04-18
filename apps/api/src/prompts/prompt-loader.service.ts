import { Injectable } from "@nestjs/common";
import { loadAndRender, type PromptCategory } from "@qa/prompts";

@Injectable()
export class PromptLoaderService {
  load(category: PromptCategory, name: string, vars: Record<string, string | number> = {}): Promise<string> {
    return loadAndRender(category, name, vars);
  }
}
