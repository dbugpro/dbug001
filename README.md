# Sequence Heartbeat

A fun and addictive sequence-matching rhythm game. Test your reflexes by following the pattern D-B-A-C. Press the correct keys to score points, but be careful! One wrong move and you lose a heart.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (version 16 or higher)
- [Git](https://git-scm.com/)

### Cloning the Repository

1. Open your terminal or command prompt.
2. Clone the repository using the command below (replace `<your-repo-url>` with your actual repository URL):
   ```bash
   git clone <your-repo-url>
   ```
3. Navigate into the project directory:
   ```bash
   cd sequence-heartbeat
   ```

### Running Locally

1. Install the project dependencies:
   ```bash
   npm install
   ```
   *(You can also use `yarn` or `pnpm` if you prefer).*

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the local URL shown in your terminal (usually `http://localhost:5173`).

## Deployment on Vercel

Vercel is the recommended platform for deploying Vite React applications. Follow these steps to deploy your game for free:

1. **Push to GitHub**
   - Ensure your code is committed and pushed to a repository on your GitHub account.

2. **Log in to Vercel**
   - Visit [vercel.com](https://vercel.com) and sign up or log in using your GitHub account.

3. **Import Project**
   - Click the **"Add New..."** button and select **"Project"**.
   - Find your `sequence-heartbeat` repository in the list and click **"Import"**.

4. **Configure Settings**
   - Vercel will automatically detect the framework as **Vite**.
   - **Root Directory**: `./` (default)
   - **Build Command**: `vite build` (default)
   - **Output Directory**: `dist` (default)
   - You do not need to add any Environment Variables for the basic version of this app.

5. **Deploy**
   - Click the **"Deploy"** button.
   - Vercel will build your application. Once complete, you will see a preview image and a live URL (e.g., `https://your-project.vercel.app`).

Your game is now live and ready to be shared!