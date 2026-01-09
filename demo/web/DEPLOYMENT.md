# GitHub Pages Deployment Guide

This guide explains how to deploy the demo web app to GitHub Pages using GitHub Actions.

## Prerequisites

1. Repository is on GitHub (e.g., `egpivo/payg-service-contracts`)
2. You have admin access to the repository

## Setup Steps

### Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. Save the settings

### Step 2: Merge to Main Branch

After merging your `web-ui` branch to `main`, the GitHub Actions workflow will automatically:
- Build the Next.js app in mock mode
- Deploy to GitHub Pages

### Step 3: Verify Deployment

1. Go to **Actions** tab in your repository
2. Wait for the "Deploy to GitHub Pages" workflow to complete
3. Once successful, your site will be available at:
   ```
   https://egpivo.github.io/payg-service-contracts/
   ```

## Workflow Details

The workflow (`.github/workflows/deploy-gh-pages.yml`) automatically:
- Triggers on push to `main` branch
- Builds with mock mode enabled (no wallet required)
- Sets correct base path for GitHub Pages
- Deploys static site to GitHub Pages

## Manual Trigger

You can also manually trigger the deployment:
1. Go to **Actions** tab
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow** → **Run workflow**

## Troubleshooting

- **Workflow fails**: Check the Actions tab for error logs
- **404 on GitHub Pages**: Verify base path matches repository name
- **Site not updating**: Wait a few minutes for GitHub Pages to propagate changes
