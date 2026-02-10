# Vercel Deployment Guide

This guide will walk you through the process of deploying your Shelby Upload Tool application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [Vercel.com](https://vercel.com/)
2. **GitHub Account**: Your code should be hosted on GitHub
3. **Environment Variables**: You'll need your Shelby API keys ready

## Step 1: Connect GitHub to Vercel

1. **Log in to Vercel** and navigate to your dashboard
2. **Click "Add New..."** and select "Project"
3. **Import from GitHub** section, search for your repository (`wuya51/shelby-upload-tool`)
4. **Click "Import"** to connect your repository

## Step 2: Configure Project Settings

1. **Project Name**: Keep the default or choose a custom name
2. **Framework Preset**: Select "Vite" (since this is a Vite-based React application)
3. **Root Directory**: Leave as `./` (unless your application is in a subdirectory)

## Step 3: Set Up Environment Variables

1. **Scroll down to "Environment Variables"** section
2. **Add the following variables**:

   | Variable Name | Value |
   |---------------|-------|
   | VITE_SHELBY_API_KEY | Your API key from [Geomi.dev](https://geomi.dev/) |
   | VITE_SHELBY_BEARER_TOKEN | Your token from [Shelby Explorer](https://explorer.shelby.xyz/) |

3. **Click "Add"** for each variable

## Step 4: Deploy the Application

1. **Click "Deploy"** to start the deployment process
2. **Wait for the deployment** to complete (this may take a few minutes)
3. **Once deployed**, you'll see a success message with your application URL

## Step 5: Access Your Deployed Application

1. **Click the generated URL** to view your application
2. **Test the functionality** to ensure everything is working correctly

## Step 6: Set Up Automatic Deployments

Vercel automatically sets up continuous deployment, so any changes you push to your GitHub repository will trigger a new deployment.

## Step 7: Custom Domain (Optional)

1. **Navigate to your project settings** in Vercel
2. **Click "Domains"** and add your custom domain
3. **Follow the instructions** to configure your DNS settings

## Troubleshooting

### Common Issues

1. **Environment Variables Not Found**
   - Double-check that you added all required variables
   - Ensure variable names match exactly what's in your code

2. **Build Failures**
   - Check your Vercel logs for error details
   - Ensure all dependencies are properly listed in package.json

3. **API Connection Errors**
   - Verify your API keys are correct
   - Ensure your keys have the necessary permissions

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/deploy.html#vercel)
- [Shelby Network Documentation](https://docs.shelby.xyz/)

## Deployment Status

After successful deployment, your application will be available at a URL like:
`https://shelby-upload-tool.vercel.app`

You can always view and manage your deployment from your Vercel dashboard.