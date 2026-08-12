import fs from "fs";
import path from "path";
import https from "https";

function downloadSourceCode(
  chainId,
  contractAddress,
  outputDir = "./contracts",
) {
  // Construct the Sourcify API URL
  const apiUrl = `https://sourcify.dev/server/files/tree/any/${chainId}/${contractAddress}`;

  console.log(`Fetching metadata from ${apiUrl}`);

  // Fetch the contract metadata
  https
    .get(apiUrl, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.error(`HTTP error! status: ${res.statusCode}`);
          return;
        }

        try {
          const metadata = JSON.parse(data);

          // Create the output directory if it doesn't exist
          const contractDir = path.join(
            outputDir,
            `${chainId}_${contractAddress}`,
          );
          fs.mkdirSync(contractDir, { recursive: true });

          console.log("Downloading source files...");

          // Download each source file
          metadata.files.forEach((fileUrl) => {
            const filename = path.basename(fileUrl);
            const filePath = path.join(contractDir, filename);

            https
              .get(fileUrl, (fileRes) => {
                let fileData = "";

                fileRes.on("data", (chunk) => {
                  fileData += chunk;
                });

                fileRes.on("end", () => {
                  fs.writeFileSync(filePath, fileData);
                  console.log(`Downloaded: ${filename}`);
                });
              })
              .on("error", (error) => {
                console.error(`Error downloading ${filename}:`, error);
              });
          });

          // Save metadata
          const metadataPath = path.join(contractDir, "metadata.json");
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

          console.log(`
Contract files download initiated!
Location: ${contractDir}
Number of files: ${metadata.files.length}
        `);
        } catch (error) {
          console.error("Error processing data:", error);
        }
      });
    })
    .on("error", (error) => {
      console.error("Error fetching metadata:", error);
    });
}

// Example usage
const chainId = 1; // Ethereum Mainnet
const contractAddress = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"; // Example contract (AAVE)

downloadSourceCode(chainId, contractAddress);
