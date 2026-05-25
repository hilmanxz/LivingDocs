import type { CommandHandler, AskOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { ArchitectureGraph, LLMClient, ContextBuilder, QueryEngine } from '@livingdocs/core';
import { resolve } from 'path';

/**
 * Ask a natural language question about the codebase.
 *
 * This command uses the architecture graph and LLM to answer
 * questions about code structure, dependencies, and design decisions.
 */
export const ask: CommandHandler<AskOptions> = async (options) => {
  const logger = createLogger(options);
  const projectRoot = process.cwd();
  const question = options.question;

  logger.header(`Question: ${question}`);

  try {
    // Load the architecture graph
    const graphPath = resolve(projectRoot, '.livingdocs', 'graph.json');
    const graph = await ArchitectureGraph.loadFromFile(graphPath);

    // Initialize LLM client from environment
    const llmClient = LLMClient.fromEnv();

    // Create context builder with reasonable token limit
    const contextBuilder = new ContextBuilder(8000);

    // Create query engine
    const queryEngine = new QueryEngine(graph, llmClient, contextBuilder);

    // Execute query
    const result = await queryEngine.query(question);

    if (options.json) {
      logger.json({
        status: 'success',
        question,
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources,
        relatedNodes: result.relatedNodes.map(n => ({
          id: n.id,
          type: n.type,
          name: n.name,
          path: n.path,
        })),
      });
    } else {
      logger.info('');
      logger.info(result.answer);
      logger.info('');

      // Show confidence
      const confidenceLabel =
        result.confidence >= 0.8
          ? 'High'
          : result.confidence >= 0.5
            ? 'Medium'
            : 'Low';
      logger.info(`Confidence: ${confidenceLabel} (${(result.confidence * 100).toFixed(0)}%)`);

      // Show sources
      if (result.sources.length > 0) {
        logger.info('');
        logger.info('Sources:');
        for (const source of result.sources.slice(0, 5)) {
          logger.info(`  - ${source.path} (relevance: ${(source.relevance * 100).toFixed(0)}%)`);
        }
      }

      // Show related nodes
      if (result.relatedNodes.length > 0) {
        logger.info('');
        logger.info('Related:');
        for (const node of result.relatedNodes.slice(0, 5)) {
          logger.info(`  - ${node.type}: ${node.name}${node.path ? ` (${node.path})` : ''}`);
        }
      }
    }
  } catch (error) {
    if (options.json) {
      logger.json({
        status: 'error',
        question,
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        logger.error(
          'No architecture graph found. Run `livingdocs scan` first to build the graph.'
        );
      } else if (error instanceof Error && error.message.includes('Missing API key')) {
        logger.error(
          `${error.message}\nSet the appropriate environment variable to use the ask command.`
        );
      } else {
        logger.error(
          `Query failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    process.exit(1);
  }
};
