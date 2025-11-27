// ABOUTME: Creates GitHub branches and commits via the GitHub API
// ABOUTME: Provides createBranch and createCommit functions for programmatic repo changes

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_API_KEY });

/**
 * Creates a new branch from an existing branch.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} baseBranch - Branch to create from (e.g., 'main')
 * @param {string} newBranch - Name for the new branch
 * @returns {Promise<{branch: string, sha: string}>}
 */
async function createBranch(owner, repo, baseBranch, newBranch) {
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = refData.object.sha;

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseSha,
  });

  return {
    branch: newBranch,
    sha: baseSha,
  };
}

/**
 * Creates a commit with file changes on a branch.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch to commit to
 * @param {Array<{path: string, content: string}>} files - Files to add/modify
 * @param {string} message - Commit message
 * @returns {Promise<{commitSha: string}>}
 */
async function createCommit(owner, repo, branch, files, message) {
  // Get the current commit SHA of the branch
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const currentCommitSha = refData.object.sha;

  // Get the tree SHA of the current commit
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });
  const baseTreeSha = commitData.tree.sha;

  // Create blobs for each file
  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data: blobData } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      };
    })
  );

  // Create a new tree
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: blobs,
  });

  // Create the commit
  const { data: newCommitData } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeData.sha,
    parents: [currentCommitSha],
  });

  // Update the branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommitData.sha,
  });

  return {
    commitSha: newCommitData.sha,
  };
}

// Example usage with mock values
async function main() {
  try {
    const branchResult = await createBranch(
      'mock-owner',
      'mock-repo',
      'main',
      'feature/new-feature'
    );
    console.log('Branch created:', branchResult.branch);

    const commitResult = await createCommit(
      'mock-owner',
      'mock-repo',
      'feature/new-feature',
      [
        { path: 'README.md', content: '# Hello World\n\nThis is a test.' },
        { path: 'src/example.js', content: 'console.log("Hello!");' },
      ],
      'Add initial files'
    );
    console.log('Commit SHA:', commitResult.commitSha);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

module.exports = { createBranch, createCommit };
