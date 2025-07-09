## Getting Started

To get started with the Identity Demo App, follow these steps:

1. **Clone the Repository**

   ```bash
   git clone https://github.com/GoodDollar/GoodSdks
   ```

2. **Navigate to the Project Directory**

   ```bash
   cd GoodSDKs
   ```

3. **Install Dependencies**

   The monorepo uses [Yarn Workspaces](https://yarnpkg.com/features/workspaces) for dependency management.
   Make sure to run yarn build, as the demo apps are not pulling in the goodsdk packages from npm, but rely on the locally build versions

   ```bash
   yarn install --immutable && yarn build
   ```

4. **Start the Development Server**

   Navigate to the desired application and start the development server.

   ```bash
   cd apps/demo-identity-app
   yarn dev
   ```

5. **Access the Application**

   Open your browser and navigate to `http://localhost:3000` to view the demo.

## Usage

### Developing with `citizen-sdk`

To utilize the `citizen-sdk` within your application:

1. **Import the SDK**

   ```typescript file.tsx
   import { useIdentitySDK } from "citizen-sdk"
   ```

2. **Initialize the SDK**

   ```typescript file.tsx
   const identitySDK = useIdentitySDK("development")
   ```

3. **Use SDK Functions**

   ```typescript file.tsx
   const checkWhitelist = async (account: string) => {
     try {
       const { isWhitelisted, root } =
         await identitySDK.checkIsWhitelisted(account)
       console.log(`Is Whitelisted: ${isWhitelisted}, Root: ${root}`)
     } catch (error) {
       console.error(error)
     }
   }
   ```

For more examples and detailed usage, refer to the [citizen-sdk README](packages/citizen-sdk/README.md).
