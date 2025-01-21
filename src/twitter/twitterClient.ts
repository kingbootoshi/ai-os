// Twitter client connectivity and authentication

import { Scraper } from 'goat-x';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Scraper instance for interacting with Twitter
export const scraper = new Scraper();

// Function to log in and save cookies
export async function loginAndSaveCookies() {
  console.log("Attempting to authenticate with Twitter...");
  try {
    // Log in using credentials from environment variables
    await scraper.login(
      process.env.TWITTER_USERNAME!,
      process.env.TWITTER_PASSWORD!,
      process.env.TWITTER_EMAIL
    );

    // Retrieve the current session cookies
    const cookies = await scraper.getCookies();

    // Create directory if it doesn't exist
    const cookiesDir = path.dirname(path.resolve(__dirname, 'cookies.json'));
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }

    // Save the cookies to a JSON file for future sessions
    fs.writeFileSync(
      path.resolve(__dirname, 'cookies.json'),
      JSON.stringify(cookies)
    );

    console.log('Successfully authenticated and saved session.');
  } catch (error) {
    console.error('Authentication failed:', error);
    throw new Error('Failed to authenticate with Twitter. Please check your credentials.');
  }
}

// Function to load cookies from the JSON file
export async function loadCookies() {
  const cookiesPath = path.resolve(__dirname, 'cookies.json');
  
  // Check if cookies file exists
  if (!fs.existsSync(cookiesPath)) {
    // Return silently - will trigger new login
    return false;
  }

  try {
    // Read cookies from the file system
    const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
    const cookiesArray = JSON.parse(cookiesData);

    // Map cookies to the correct format (strings)
    const cookieStrings = cookiesArray.map((cookie: any) => {
      return `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
        cookie.secure ? 'Secure' : ''
      }; ${cookie.httpOnly ? 'HttpOnly' : ''}; SameSite=${
        cookie.sameSite || 'Lax'
      }`;
    });

    // Set the cookies for the current session
    await scraper.setCookies(cookieStrings);
    return true;
  } catch (error) {
    // If there's an error reading/parsing cookies, delete the corrupt file
    try {
      fs.unlinkSync(cookiesPath);
    } catch (e) {
      // Ignore deletion errors
    }
    return false;
  }
}

// Function to ensure the scraper is authenticated
export async function ensureAuthenticated() {
  try {
    // Attempt to load cookies from cookies.json
    const cookiesLoaded = await loadCookies();

    // Check if the scraper is logged in
    const loggedIn = cookiesLoaded && await scraper.isLoggedIn();
    
    if (loggedIn) {
      // Successfully authenticated with existing cookies
      return true;
    } else {
      // If not logged in or no cookies, perform fresh login
      await loginAndSaveCookies();
      return true;
    }
  } catch (error) {
    throw new Error(`Twitter authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}