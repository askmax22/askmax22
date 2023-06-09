ifdef::env-github[]
:tip-caption: :bulb:
:note-caption: :information_source:
:important-caption: :heavy_exclamation_mark:
:caution-caption: :fire:
:warning-caption: :warning:
endif::[]
:toc:
:toc-placement!:
:toclevels: 3
:toc-title:
:args: Input/Output
:example: Example usage

= VickiScript Developer Guide

Learn everything about writing scripts for Vicki and teach Alexa new skills that controls your web browser or computer.
We call these scripts "VickiScript".

This document expects the reader to be proficient in JavaScript and is focused on API definitions.

toc::[]

==  Introduction to VickiScript
VickiScripts are JavaScript code that are run in your browser when an Alexa hears a command. See the example below and the comments to the right to get an idea:

```javascript
// ==VickiScript==                               // <<< 1. Declare this is a VickiScript (Metablock)
// @name Get Started                             // <<< 2. Name your script
// @utterance Ask $invocation to get started     // <<< 3. Guide users on how to use your script
// ==/VickiScript==                              // <<< 4. End metablock

                                                  // \/ 5. Listen for requests for "get started" command
$vs.listen(/^get started$/, async (request, response) => {         
  const url = 'https://en.wikipedia.org/wiki/%22Hello,_World!%22_program';
  await browser.tabs.create({ url });             // <<< 6. Use browser extension to open a tab
  response.say('Opening hello world').send();     // <<< 7. Respond back to the request and
                                                  //        make Alexa talk
});
```

See link:#request[Request], link:#response[Response], and link:#browser[browser] for their respective API.

=== Execution Environment
When Vicki receives a request from Alexa, it passes the command to every script serially ordered by the script rank until one of the script responds back with a message for Alexa. It runs multiple passes to allow scripts to conceede to others.

The script runs inside of a WebWorker and have a limited apis available to use. Scripts can control the web browser using the `link:browser[browser]` api or the computer using `link:#vs-native[$vs.native]` api. See link:#api-reference[API Reference] for details.

= Metablock
Metablock allows you to describe your script to Vicki. It looks like this in the beginning of your script:
```javascript
// ==VickiScript==
// @name Get Started
// @utterance Ask $invocation to get started
// ==/VickiScript==
```

The requirements for a metablock are:

* Must start with the line: `// ==VickiScript==`
** Must be in beginning of file before any other code (excluding comment).
* Must include a @name property: `// @name Script Name`
* Must end with the line: `// ==/VickiScript==`

== @description
Detailed description of the script, multiple description fields are concatenated.

== @icon
Http URL to an image to show, image can be anything browser can draw inside image tag and is expected to be of size at least 32x32 pixels.

== @id
Optional field to show a different name in console logs. Limited to the regex `/[0-9a-z_\-\.]/`. If not defined, will default to name.

== @name
Name that will be displayed by default everywhere. This is the only mandatory field.

== @permission
Defines what permission are needed by this script. Here is a comprehensive list of permissions:

- A URL match pattern using link:https://developer.chrome.com/apps/match_patterns[Chrome Match Pattern] required to interact with a page directly when using some *browser* apis.
- *browser.**: To access browser.* apis.
- *native*: To access $vs.native apis.

*{example}*
```javascript
// @permission *://*.amazon.com
// @permission browser.history
// @permission browser.topSites
```

== @updateUrl
List of HTTPS urls that will host the script for updating. Vicki will hit these URL's to update the script (check @version to meet requirement). ALL urls defined here must have latest version of the script as Vicki will load balance amongst them.

== @utterance
Defines a example utterances user can say to invoke the script. Supports placeholder `$invocation` to let Vicki insert its own invocation name.

Define this multiple time to provide multiple examples, order is respected.

*{example}*
```javascript
// @utterance Ask $invocation to get download status
// @utterance Tell $invocation to pause download
// @utterance Ask $invocation what is my name
```

== @version
Integer value defining the current version number of this file. Defaults to 1.

When you want users to update the script, this number must be defined and incremented.

= API Reference
== $vs.listen(condition: ListenCondition|ListenCondition[], callback: ListenHandler)
Start listening for Alexa requests, the callback is invoked once per request session if the condition matches.

When a request comes in, Vicki will start invoking all listeners that are installed. The listeners are executed serially, ordered by the scripts rank. The first script to return a Alexa response will be considered the responder. If no scripts respond then Vicki will start a second pass, with the request denoting that its a second pass and repeat the process.

There will be a maximum of 3 passes before Vicki gives up.

*ListenCondition*
A listen condition can be a Regex in `string` form, `RegExp`, or a object with the properties:
```javascript
{
  utterance: RegExp|string|RegExp[]|string[];
  precondition: (request: Request) => boolean;
  pass: number;
}
```

When a array of ListenCondition is passed in, the pass filter defaults to the array index. So if you pass in:
```javascript
$vs.listen([/^hello world$/, /^hello$/], () => {
  ...
})
```
The "hello world" will only be matched on the first pass, while "hello" will only be matched on the second pass.
The callback will be invoked if any of the ListenCondition matches.

*ListenHandler {args}*

ListenHandler Function: `(request: link:#request[Request], response: link:#response[Response], regexMatch:RegexArrayMatch): Promise<void>`

> `request: link:#request[Request]` - Request to be processed.
>
> `response: link:#response[Response]` - Response to send back to Alexa.
>
> `match: link:https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match[RegexArrayMatch]` - Regex match result on the matched condition.
>
> Return a promise for when execution is complete. The promise should only be fulfilled after no further response is expected.

*{example}*
```javascript
$vs.listen(`hello world`, async (request, response, regexMatch) => {
  response.say('hello!').send();
});
```

=== $vs.listen.findHandler(request: Request): HandlerSearchResult|undefined
Find a registered handler given a request.

*{args}*

> `request: link:#request[Request]` - Request input
>
> Returns `HandlerSearchResult` iff a handler is found for the request, or undefined if one wasn't found.

*HandlerSearchResult properties*

> `handler: Function` - Handler function that was registered with `vs.listen`.
>
> `match: link:https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match[RegexArrayMatch]` - Regex match result from the utterance.

*{example}*

```javascript
const handler = async (req, res, match) => {
  ...
});

$vs.listen(/^zoom (in|out)$/, handler);

// test
const result = $vs.listen.findHandler({ utterance: "zoom in" });
expect(result).to.deep.equal({ handler, match: ["zoom in", "in"] });
```

=== $vs.listen.invoke(request: Request, response: Response): Promise<boolean>

Invoke a listener with a request handler that was registered with $vs.listen.

*{args}*

> `request: link:#request[Request]` - Request input
>
> `response: link:#response[Response]` - Response input.
>
> Returns `boolean`, true iff the request was received by a handler.

*{example}*

```javascript
// test
const handled = await $vs.listen.invoke({ utterance: "browse amazon", pass: 1 }, response);
chai.expect(handled).to.equal.true;
```

=== $vs.listen.precondition(predicate: (request: Request) => boolean)

Register a global precondition that must return true for any any handler to receive a request.

*Callback {args}*

> `request: link:#request[Request]` - Request to allow/disallow
>
> Returns `boolean`, true iff the ListenCondition should be compared.

*{example}*
```javascript
$vs.listen.precondition(() => $vs.native.available);
```

== Request

=== pass: number
When all scripts skip a request then another pass is done on all the scripts with the pass number incremented. This allows scripts to lower their threshold for processing a request.

There are a total of 3 passes, first pass is 0.

*{example}*
```javascript
if (request.pass === 0 && request.utterance === 'hello world') {
  console.log('matched!');
} else if (request.pass > 0 && request.startsWith('hello ')) {
  console.log('good enough!');
}
```

=== raw: link:https://developer.amazon.com/docs/custom-skills/request-and-response-json-reference.html#request-body-syntax[AlexaRequest]

Raw packet from Alexa on what the users request was. See Amazon Alexa's documentation on the specification.

See Alexa's link:https://developer.amazon.com/docs/custom-skills/request-and-response-json-reference.html#request-body-syntax[Request and Response JSON Reference]` for the request API.

*{example}*
```javascript
if (request.raw.request.type === 'LaunchRequest') {
  console.log('Received a launch request');
}
```

=== utterance: string
The parsed utterance that user requested, this will be a stripped-down version of what user says. It will always be lowercased and trimmed of outer white spaces. If user says `Alexa ask web browser to scroll down` then the utterance might be `scroll down`.

This may be an empty string if Alexa interpreted the utterance as a special intent, for example if the user says `Stop`.

Things to consider while reading this property:

. A phonetically pronounced sound may have different meaning based on context, and Alexa might return an unexpected text. For example "right" and "write" sounds the same and it's unpredictable which one is returned.
. User can say ask the same things in different ways, even after being trained. e.g.
   - `Alexa ask web browser what is my download status?`
   - `Alexa tell web browser to get my download status.`
   - `Alexa ask web browser what am I downloading?`
   - `Alexa ask web browser am I downloading anything?`

*{example}*
```javascript
const match = request.utterance.match(/^scroll (?:to the )?(down|up|bottom|top)$/);
if (match) {
  console.log(`Requested to scroll to ${match[1]}`);
}
```

== Response
=== raw(response: AlexaResponse)
Send a response back using packet that Alexa understands.

*{args}*
> `response: link:https://developer.amazon.com/docs/custom-skills/request-and-response-json-reference.html#response-format[AlexaResponse]` - Raw alexa json model.

See Alexa's link:https://developer.amazon.com/docs/custom-skills/request-and-response-json-reference.html#response-format[Request and Response JSON Reference]` for the response API.

*{example}*
```javascript
response.raw({
  version: "1.0",
  response: {
    outputSpeech: {
    type: "PlainText",
    text: "My raw response"
    },
    shouldEndSession: true
  }
});
```


=== reprompt(content: string, type: string): Response
Same as *say* but used for prompting the user again if the user doesn't respond immediately during a sendAndListen.

*{args}*

> `content: string` - Content of what to say. Be aware that final payload must be less than 6000 bytes.
>
> `type: string` - Type of content, supported values: 'PlainText', 'SSML'. Defaults to 'PlainText'.
>
> Returns `link:#response[Response]`, same instance to enable chaining.

*{example}*

See *sendAndListen*.

=== say(content: string, type: string): Response
Sets what to verbally say on a response when send is invoked.

See documentation for SSML in Alexa's link:https://developer.amazon.com/docs/custom-skills/speech-synthesis-markup-language-ssml-reference.html[Speech Synthesis Markup Language Reference].

*{args}*

> `content: string` - Content of what to say. Be aware that final payload must be less than 6000 bytes.
>
> `type: string` - Type of content, supported values: 'PlainText', 'SSML'. Defaults to 'PlainText'.
>
> Returns `link:#response[Response]`, same instance to enable chaining.

*{example}*
```javascript
// Say hello
response.say('Hello!').send();

// Say hello with a pause using SSML.
response.say('<speak>Hello <break time="2s"/> World!</speak>', 'SSML').send();
```

=== send()
Send a response back to Alexa, this will end the session. Setup what content to send back by calling <b>say</b> before invoking this.

*{example}*
```javascript
if (request.utterance === 'hello world') {
  return response.say('hello!').send();
}
```

=== sendAndListen(): Promise<Request>
Sends a prompt back to Alexa and waits for user to respond back. Setup what content to send back by calling *say* and *reprompt* before invoking this.

After the promise is fulfilled, this response object is reset and a response becomes pending.

*{args}*

> Returns `Promise<link:#request[Request]>` which contains the users response. If user does not respond, it's still considered a request with cancel intent. The promise is fulfilled when user responds back.

*{example}*
```javascript
if (request.utterance !== 'knock knock') {
  return;
}

request = await response
  .say('who is there?')
  .reprompt('I said who is there?')
  .sendAndListen();

// At this point the request is the response back from the user
// and the same response object is expecting a new send.
if (request.utterance === 'vicki') {
  response.say('come on in!').send();
} else {
  response.say(`${request.utterance} who?`).send();
}
```


== browser
Limited set of Web Extensions API is available within the execution environment. This enables you to interact with the browser. This is the same as chrome's extension API but with Promise instead of callback and `browser` instead of `chrome` as the ingress.

Supported namespaces:

* bookmarks
* downloads
* history
* sessions
* storage
* system
* tabs
* topSites
* webNavigation
* windows

See API reference from others to learn more:

* link:https://developer.chrome.com/extensions/api_index[Chrome Extensions API reference]
* link:https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API[Firefox Web Extensions API reference]

*{example}*
```javascript
// Reload the focused tab
const tab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
if (!tab) {
  return;
}

await browser.tabs.reload(tab.id, { bypassCache: true });
```

Note: Vicki is proxying all requests and thus some capability may not be available. Events are not supported.

=== Permission for browser access
To use browser, you must request for permission in the link:#@permission[metablock] with the namespace needed. For example, to access `browser.downloads.resume` you must request the permission:
```javascript
// @permission browser.downloads
```
The permission requirement in Vicki doesn't match Chrome Extension/Firefox Web Extension and is coarser.

`browser.tabs` and `browser.windows` permission does not need to be requested.

To access content of a frame/tab using features like `browser.tabs.executeScript` and `browser.tabs.insertCSS`, you must also have access to the url being displayed. You can request permission using link:https://developer.chrome.com/apps/match_patterns[Chrome Match Pattern], for example:
```javascript
// @permission *://*.amazon.com/*
// @permission <all_urls>
```

== $vs.native
Control the user's computer if the user installed the native addon. Using this requires the permission:

```
// @permission native
```

=== available: boolean
Returns true iff native addon is enabled and usable.

*{example}*

```javascript
$vs.listen.precondition(() => $vs.native.available && $vs.native.os === "win");
```

=== exec(command: string, opts: ExecOptions): Promise<ExecOutput>
Run a child process using nodejs and get its output. See link:https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_child_process_exec_command_options_callback[NodeJS child_process.exec] for details.

*{args}*

> `command: string` - Command to run with space-separated arguments.
>
> `opts: ExecOptions` - Additional options on how to run.
>
> Returns a promise which resolves to `ExecOutput` once the command finishes execution or times out.

*ExecOptions properties*

Inherits properties from link:https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_child_process_exec_command_options_callback[NodeJS child_process.exec] options and adds these additional properties:

> `failOnNonZeroExitCode: boolean` - If process returns with a non zero exit code, reject the Promise with a error exception. Defaults to true.

*ExecOutput properties*

> `exitCode: number` - Exit code returned by process.
>
> `stdout: string` - Raw accumulated content of stdout in string format.
>
> `stderr: string` - Raw accumulated content of stderr in string format.

*{example}*

```javascript
async function getOsxVolume(cmd) {
  const result = await $vs.native.exec(`osascript -e 'output volume of (get volume settings)'`);

  return parseInt(result.stdout.trim());
}

function lockWindows() {
    return $vs.native.exec("rundll32.exe user32.dll,LockWorkStation");
}
```

=== os: string
Returns which os user is running. See link:https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/PlatformOs[PlatformOs MDN Documentation] for possible values.

*{example}*

```javascript
$vs.listen.precondition(() => $vs.native.available && $vs.native.os === "win");
```

=== runJs(js: string|Function, ...params): Promise<any>
Run a js command in a nodejs 8.x instance and return the output.

These following modules are available to import:

- link:https://nodejs.org/docs/latest-v8.x/api/[NodeJS v8.x core]
- link:https://github.com/shelljs/shelljs/releases/tag/v0.8.1[shelljs v0.8.1]
- link:https://github.com/kelektiv/node-uuid/releases/tag/v3.2.1[uuid v3.2.1]


*{args}*

> `js: string|Function` - Code to run in the locally running nodejs instance.
>
> `...params` - Pass in json serializable parameters for the function passed in. Only applicable if a Function is passed in. 
>
> Returns a Promise of the output of the code executed. If an exception occurs during the execution, this Promise will be rejected.

*{example}*

```javascript
// Writing a file to a temp folder and return the path. 
const storedPath = await $vs.native.runJs((content) => {
  const uuid = require("uuid");
  const path = `/tmp/${uuid.v4()}`;
  require("fs").writeFileSync(path, content);
  return path;
}, "my file content");
```

== $vs.utils
Pre-packaged set of helper functions to help write scripts.

=== $vs.utils.browser.getFocusedTab(): Promise<Tab|undefined>
Gets the current focused tab on the focused window. If some other application has focus then the focused tab is not considered focused.

*{args}*

> Returns Promise<link:https://developer.chrome.com/extensions/tabs#type-Tab[Tab]|undefined>, resolves to a Tab only if there is a focused window with a focused tab.

*{example}*
```javascript
const tab = await $vs.utils.browser.getFocusedTab();
if (!tab) {
  return response.say("No open tab").send();
}

await browser.tabs.reload(tab.id, { bypassCache: true });
```

=== $vs.utils.test(cb: (context: TestContext) => void)
Register a function to run describes tests using Mocha. The following packages are available:

- link:https://mochajs.org/[Mocha Js v5.0] - For describing your test
- link:http://www.chaijs.com/[Chai v4.1] - For asserting your expectations
- link:https://github.com/testdouble/testdouble.js[testdouble.js v3.5] - For mocking your test cases

*TestContext properties*

> `response: link:#response[Response]` - A testdouble mocked Response object that is reset when `td.reset()` is invoked.

*{example}*

```javascript
$vs.utils.test(({ response }) => {
  describe("amazon search", () => {
    afterEach(() => {
      td.reset()
    });

    it("start shopping for blue pants", async () => {
      td.replace(browser.tabs, "create");

      await $vs.listen.invoke({ utterance: "start shopping for blue pants" }, response);
      td.verify(browser.tabs.create({ url: "https://www.amazon.com/s/?field-keywords=blue%20pants" }));
      td.verify(response.send());
    });
  });
});
```

```
$vs.utils.test(() => {
  const expect = chai.expect;

  describe("listen regex", () => {
    it("should match zoom in", () => {
      const result = $vs.listen.findHandler({ utterance: "zoom in" });
      expect(result).to.deep.equal({ handler, match: ["zoom in", "in"] });
    });

    it("should not match zoom over", () => {
      const result = $vs.listen.findHandler({ utterance: "zoom over" });
      expect(result).to.be.undefined;
    });
  });
});
```

=== $vs.utils.test.minimal(cb: () => Promise<void>)
Same as $vs.utils.test, without any test framework outside of log capture.

All logs are captured the moment test starts and until the test callback resolves its promise.

*{args}*

> `cb: () => Promise<void>` - A callback that should start testing when invoked. And the promise should resolve once the test is complete.

*{example}*

```javascript
$vs.utils.test.minimal(async () => {
  console.log("Started running test");
  importScripts("https://cdnjs.cloudflare.com/ajax/libs/mocha/5.0.1/mocha.min.js");

  ...
});
```

=== $vs.utils.text.parseNumber(utterance: string): number|undefined
Parse a single numerical value from an utterance.

*{args}*

> `utterance: string` - Utterance to parse for number
>
> Returns number from a utterance string, returns undefined if a number is not found.

*{example}*
```javascript
console.log($vs.utils.text.parseNumber("five hundred and eleven")); // Will log 511
console.log($vs.utils.text.parseNumber("five point one")); // Will log 5.1
console.log($vs.utils.text.parseNumber("sixteen")); // Will log 16
```

=== $vs.utils.vui.sayLong(opts: SayLongOptions): Promise<void>

Because Response.say has a upper limit, longer responses can be made using this. There is no upper bound here, Alexa will be sent the long string in chunks.

*{args}*

SayLongOptions properties:

> `content: string` - Content to respond back, no size limit. Only PlainText, no SSML allowed.
>
> `response: link:#response[Response]` - Response object to use.
>
> `prompt: string` - Optional. Prompt for continuation.
>
> `reprompt: string` - Optional. Re-prompt for continuation.

Promise returns only after all communication ends.

=== $vs.utils.vui.select(opts: SelectOptions): Promise<number|undefined>
Give the user a list of strings to pick from by displaying it onto the UI.

*{args}*

SelectOptions properties:

> `response: link:#response[Response]` - Response object to use.
>
> `tabId: number` - ID of the tab to show the select UI in. This can be
acquired from browser extensions api.
>
> `options: string[]` - Array of options to show to the user in the UI.
>
> `prompt: string` - Optional. What to verbally ask when showing the select options.
>
> `reprompt: string` - Optional. Same as prompt but for the reprompt.
>
> `title - string` - Optional. Title to show on the UI.
>
> Returns a promise that is fulfilled after the user responds or fails to respond. The promise returns the index of the option that was selected on success, or undefined on failure cases.

= Debugging your script
== Simulator
You can launch a request simulator when editing your script. This helps simulate user utterance through text as if Alexa had requested them.

Unfortunately, your console logs won't show up in the simulator, use your browsers developer tools for that.

=== Developer Tools
Use your browsers developer tools to debug your VickiScript, it will show up as a WebWorker inside Vicki's background page.

*On Chrome*

. Open your web browser to link:chrome://extensions/[chrome://extensions/]
. Under "Vicki" and next to "Inspect views:", click "background page"
. Your script will be loaded and logging. Search for your scripts name in the console to see where it's files are hosted.

== console.log
You can see all your `console.log` by following the Developer Tools instruction. `console.log` will always prefix the name of your script in the log, this will help you distinguish it from other scripts that Vicki is running.

= Distributing your script
Vicki does not have an official script distribution portal but it does make it easy to share a script with others. Just name your script file with the suffix ".vicki.js" and share it on the internet. Whenever a ".vicki.js" file is opened in the web browser, Vicki will prompt the user to install it.

Feel free to share your script on code repository sites like github.