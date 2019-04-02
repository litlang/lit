# Strat Bookstore Guide

In this guide we'll make a simple bookstore that uses a:
  A) Single page application frontend
  B) frontend proxy
  C) books service that depends on an external sales service
  D) books database

We'll take this application and run it locally and on the cloud via AWS.  Sounds like a lot of work, but we'll be done in less than 100 lines of code.

Here's a classic block diagram for what we're about to build:
![Bookstore](https://strat.world/StratBookstore.png)

To complete this guide make sure you've [installed stratc](./Getting%20Started), and if you plan on running in AWS do the AWS section of the [Hello World Guide](./Hello%20World).

## Books API

We'll start by creating a simple books service and a frontend proxy that we can use to access the service.  Our proxy will receive http events and route them to the books service.  Create a file and name it "Bookstore.st", and paste the following into it:

```st
service FrontendProxy {
  include "Http"
  Http { method: "get", path: "/api/books" } -> Books.getBooks
}

service Books {
  getBooks ():any -> "./getBooks.js"
}

```

Take a look at this code and try to figure out what it does.  You'll notice two of our boxes from the box diagram are "service"s in this file--FrontendProxy and Books.  By including Http into Frontend proxy we're telling strat that its a web server, and the following line states "get requests on the /api/books path should be sent to Books.getBooks".  The Books service then sends those requests to the getBooks.js file, which you need to create with this content:

```js
const getSales = async () => [];
const books = [
  {
    "name": "The Grapes of Wrath",
    "author": "John Steinbeck"
  },
  {
    "name": "War and Peace",
    "author": "Leo Tolstoy"
  },
  {
    "name": "The C Programming Language",
    "author": "Brian Kernighan and Dennis Ritchie"
  }
];

module.exports = async function () {
  const sales = await getSales();
  const salesSet = new Set((sales || []));
  return books.map(book => {
    return {
      sale: salesSet.has(book.author),
      ...book
    };
  });
};
```

This is our humble Books service.  It has a stub getSales function that we'll fill out later, some mock books, and an exported function that gets sales then responds with the mock books adding whether or not a book is on sale.

You may not believe it, but we've already got enough to deploy our API.  Run the following in a terminal in the same directory as both of the files you've just created:

```sh
stratc Bookstore.st && stratc Bookstore.sa
```

You should see the output:

```
"Successfully created Bookstore.sa"
http source listening on http://localhost:3000
```
We declared the getBooks API to be on the path /api/books, so using a browser or curl navigate to [localhost:3000/api/books](http://localhost:3000).

```sh
curl localhost:3000/api/books
```

You may notice a new file "Bookstore.sa"--this is a "system artifact" file that stratc builds when you run it against a strat (.st) file.  System artifact files are all of the resources in your system as well as instructions for how to host and run them.  When you run stratc against an .sa file, stratc loads up a Strat Virtual Substrate and uses that to execute your .sa file.  Unless you state otherwise, stratc uses the single machine SVS that it ships with.


### Static Files

Now lets add the client "single page application".  We're going to avoid all the heavy handed stuff like React and Webpack in this tutorial.  Those tools are compatible with Strat but they add a build step that can get hairy fast, so we're keeping it to basic html and javascript.

Here's our client html file "index.html":

```html
<head>
  <style>
    .sale::after {
      content: 'on sale!';
      color: orange;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <h1>Welcome to the Strat bookstore!</h1>
  <h3>Books for sale</h3>
  <div id="books"></div>
  <script src="client.js"></script>
</body>

```

And here's our javascript bundle "client.js":

```js
async function get (path) {
  return (await fetch(path)).json();
}

function getFactory (path) {
  return () => get(path);
}

const API = {
  getBooks: getFactory('api/books')
};

async function app () {
  const books = await API.getBooks();
  const booksElement = document.querySelector('#books');
  books.map(createBookElement)
    .forEach(bookElement => booksElement.appendChild(bookElement));
}

function createBookElement (bookJson) {
  const bookElement = document.createElement('div');
  const titleContainer = document.createElement('i');
  if (bookJson.sale) {
    titleContainer.className = 'sale';
  }
  const titleElement = document.createTextNode(bookJson.name);
  titleContainer.appendChild(titleElement);
  const author = document.createElement('div');
  const authorText = document.createTextNode(`by ${bookJson.author}`);
  author.appendChild(authorText);
  bookElement.appendChild(titleContainer);
  bookElement.appendChild(author);
  bookElement.appendChild(document.createElement('br'))
  return bookElement;
}

app();
```

Its all pretty basic stuff, and within createBookElement we can see the legacy of 90s OOP and a reminder of why tools like React are so popular.

The document element API might not be simple, but at least serving these files is a two liner in Strat!  Add the following lines to Bookstore.st after include "Http":

```st
Http { method: "get", path: "/"} -> "./index.html"
Http { method: "get", path: "/client.js"} -> "./client.js"
```
Your Bookstore.st file should look like this:

```st
service FrontendProxy {
  include "Http"
  Http { method: "get", path: "/"} -> "./index.html"
  Http { method: "get", path: "/client.js"} -> "./client.js"
  Http { method: "get", path: "/api/books" } -> Books.getBooks
}

service Books {
  getBooks ():any -> "./getBooks.js"
}
```

Build and run this to see your bookstore SPA at [localhost:3000](http://localhost:3000/):

```sh
stratc Bookstore.st && stratc Bookstore.sa
```

Strat can either host your code on compute infrastructure like Lambda or Docker containers or it can host static files on blob storage like S3.  You tell Strat if it should execute your code or just serve it as a static file by adding a function signature ("getBooks ():any ->") when you want the code executed.  Since we just want to serve index.html and client.js, we leave the signature off and Strat serves the files as they are.

### Sales Dependency

Lets spice things up by adding an external service dependency.  If you've ever worked on a large service oriented architecture you know that no service exists in isolation, and connecting to external services is a massive PITA.

Change the assignment of getSales in getBooks.js:1 from
```js
const getSales = async () => [];
```
to
```js
const Strat = require('strat');
const getSales = Strat('Sales.getSales');
```

Build, run, and check out [localhost:3000/api/books](http://localhost:3000/api/books):

```
stratc Bookstore.st && stratc Bookstore.sa
```

I have led you astray!  You should see the error "Could not resolve Sales.getSales within scope for Books.getBooks".  Strat brings the concept of scope to infrastructure.  Strat's implementation of scope is based on the lexical scope you're used to in regular languages.  When you deploy your systems onto cloud substrates like AWS Strat builds roles and access control to enforce the same scope you see when you write your Strat files.  Looking at Bookstore.st now, you can see inside FrontendProxy a reference to Books.getBooks.  This works because FrontendProxy and Books are defined at the top level of the same file.  The two services exist within the same scope, and any function inside Books can call any function inside FrontendProxy.  Sales exists elsewhere, and its not included so Strat doesn't know how to resolve it within the service Books's scope.  Lets fix that by adding

```st
include "https://s0tjdzrsha.execute-api.us-west-2.amazonaws.com/Sales/strat/Sales/Sales.st"
```

to the top of the Books service, just how we have include "Http" at the top of FrontendProxy.  Build and run again, and you should see the api working [localhost:3000/api/books](http://localhost:3000/api/books), and if you check the SPA out you'll see a little on sale indicator next to one of the books.

Strat's lexical scope means now that you've included Sales inside Books, anything in Books can call anything in Sales, but Sales can't call (and doesn't know about) anything else inside your infrastructure.  When deployed to AWS, Sales gets its own Lambda that has no permissions--it can only be invoked by the Lambda Books runs on.

This concludes the N-tier architecture sans database, which we'll cover in the advanced tutorial.

Now you're not the kind of person to just blindly copy and paste code without reading it first right?  You surely noticed that you're including a Sales URL and not some file.  This is a wild idea put forth by [Deno](https://deno.land/) and it works great for service inclusions.  Strat includes can be either relative files, URLs, or std library names like "Http".  Have a look at that [included url](https://s0tjdzrsha.execute-api.us-west-2.amazonaws.com/Sales/strat/Sales/Sales.st)--its a Strat file!  This particular endpoint and Strat file was generated by the strat compiler, and its part of how two Strat services negotiate how their APIs are used.  You can learn more about this, the "public" keyword, a new standard source "Cron", and connecting to databases in the advanced guide where you build your own Sales service.
