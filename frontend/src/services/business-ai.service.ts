import { http, unwrap } from './http';
import { ChatTurn } from './ai.service';

export interface ChartSpec {
  type: 'line' | 'bar' | 'donut';
  title: string;
  categories: string[];
  series: number[];
}

export interface BusinessReply {
  insight: string;
  /** The raw tool outputs — every figure the owner sees is auditable. */
  data: Record<string, unknown>;
  recommendation: string | null;
  chartSpec: ChartSpec | null;
  /**
   * False when the AI caught the model stating a number that appears in no tool's
   * output. The UI must NOT present such an answer as fact.
   */
  grounded: boolean;
  /** Which whitelisted tools actually ran. */
  toolsUsed: string[];
}

export const businessAiService = {
  ask: (message: string, history: ChatTurn[] = []) =>
    unwrap<BusinessReply>(
      http.post('/ai/business-chat', { message, history: history.slice(-6) }),
    ),
};
