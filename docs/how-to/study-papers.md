# Study scientific papers

Open **Papers**, expand **Connect NotebookLM**, and choose **Sign in to NotebookLM**. Complete the Google sign-in in the browser window, then check the connection. Google credentials remain in ignored `setup/.notebooklm/`, on this computer.

The client is installed in the app's isolated `.venv`. On another computer, install Python 3.10 or newer and run `sh setup/install-notebooklm.sh`. The app uses notebooklm-py 0.8.3, an unofficial client for Google's internal NotebookLM interfaces. Login sessions may need refreshing when Google changes the service. `NOTEBOOKLM_PYTHON` can select another Python executable that has the pinned client installed.

Add a PDF under 40 MB and optionally give it a title. It is saved under `Assets/`, then uploaded to a new notebook in your Google account. The app asks for source-grounded questions about terminology, concepts, methods, findings and limitations. Read and edit the suggested questions, answers and evidence before accepting them. Proposed page or section references are AI suggestions; check them against the PDF.

Choose **Add selected** to write the approved cards into ordinary term Markdown files. Existing terms matched by name or alias keep their current definitions and sources and gain a paper association. Questions about methods and results have reverse cards disabled. Choose **Study this paper** to review only that paper's cards.

Paper manifests are `Papers/<UUID>.json`. They record extraction state, the NotebookLM notebook identifier, suggestions and accepted term slugs. Uploaded PDFs are protected from the CLI's orphan-asset cleanup, including while extraction is unfinished. Include paper manifests in the private vault's version control; PDFs can use the existing Drive-backed Assets folder.

Failed or interrupted extraction can be retried with the same notebook. Retrying after cards have been accepted is intentionally unavailable; upload another copy if you need a new extraction. Extraction runs while the local app is running.

## Phone access

The private [Paper Study app](https://paper-study-henri.henrik-sveinsson.chatgpt.site) is a hosted Site in ChatGPT Space. Sign in with the same ChatGPT account on your computer and phone.

On the computer, run the desktop Terms app, open Paper Study and choose **Connect this computer**. This opens a local confirmation window and pairs that browser with the desktop app. Allow the browser's local-network permission if requested. If your desktop app uses a different port, change **Connection settings → Desktop app address** before connecting.

Leave the hosted Paper Study tab open on the computer. While it is on the collection screen, it imports phone reviews into the local append-only review log and uploads changed cards approximately every 30 seconds. Browsers can slow background tabs. The connection credential stays in this browser and ignored `setup/.phone-connection.json`; it is sent only to the local app. **Disconnect this browser** removes that browser's stored connection.

The phone uses stored online cards and saves reviews online even when the computer is off. The desktop tab catches up when the computer and local app are available again. NotebookLM extraction and PDF storage still happen on the computer. The online copy includes approved cards, rendered equations, illustrations and scheduling state, not Google login credentials or PDFs.

Reviewing the same card independently in the local and hosted apps while disconnected can create a conflict. Sync detects this and stops instead of replacing history. Keep a progress export for recovery. The file transfer controls under **Backup file transfer** are a fallback for browsers that cannot connect to localhost.

The hosted source is a separate Sites repository, checked out locally under ignored `phone/`. Its project ID is `appgprj_6abcd663d2208191961684a83a68c4fe`; reopen that Site's source rather than registering a replacement. The shared interchange/scheduling module is `src/lib/study.ts`, copied to `phone/lib/study.ts` for independent deployment.

For production desktop use, run `pnpm build` then `pnpm start` and open `http://127.0.0.1:5173`. The launcher sets the matching HTTP origin and allows PDF uploads. Bind to loopback; the local desktop app itself has no public-user authentication.
