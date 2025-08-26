'use server';

import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { transcriptionModels } from '@/lib/models/transcription';
import { visionModels } from '@/lib/models/vision';
import { projects } from '@/schema';

const defaultTranscriptionModel = Object.entries(transcriptionModels).find(
  ([_, model]) => model.default
);

const defaultVisionModel = Object.entries(visionModels).find(
  ([_, model]) => model.default
);

if (!defaultTranscriptionModel) {
  throw new Error('No default transcription model found');
}

if (!defaultVisionModel) {
  throw new Error('No default vision model found');
}

export const createProjectAction = async (
  name: string,
  welcomeProject?: boolean
): Promise<
  | {
      id: string;
    }
  | {
      error: string;
    }
> => {
  try {
    const user = await currentUser();
    
    // Get userId - either authenticated user or existing session
    let userId: string;
    if (user) {
      userId = user.id;
    } else {
      // For anonymous users, get existing session ID (don't create new one here)
      const { getSessionId } = await import('@/lib/session');
      const sessionId = await getSessionId();
      if (!sessionId) {
        throw new Error('You need to be logged in to create a project!');
      }
      userId = sessionId;
    }

    const project = await database
      .insert(projects)
      .values({
        name,
        userId,
        transcriptionModel: defaultTranscriptionModel[0],
        visionModel: defaultVisionModel[0],
        welcomeProject,
      })
      .returning({ id: projects.id });

    if (!project?.length) {
      throw new Error('Failed to create project');
    }

    return { id: project[0].id };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
