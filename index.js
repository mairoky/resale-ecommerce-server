const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const stripe = require("stripe")(process.env.STRIPE_SK);


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is Running!')
})

// MongoDB Connection
{/* mongodb+srv://db_admin:<password>@cluster0.v3j0rcs.mongodb.net/test  */ }
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v3j0rcs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// console.log(uri);

// Verify JWT
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized Access');
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden Access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {

    try {

        const database = client.db('resale_ecommerc');
        const usersCollection = database.collection('users');
        const categoryCollection = database.collection('category');
        const productsCollection = database.collection('products');
        const bookingProductsCollection = database.collection('bookingProducts');
        const wishListCollection = database.collection('wishlistProducts');
        const paymentsCollection = database.collection('payments');

        // JWT
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' });
        });

        app.post('/create-payment-intent', async (req, res) => {
            const product = req.body;
            // console.log(product);
            const price = parseInt(product.product_price);
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });

        // Booking Product
        app.get('/booking/:email', async (req, res) => {
            const email = req.params.email;
            // const query = { buyer_email: email };
            const products = await bookingProductsCollection.find({ buyer_email: email }).toArray();
            res.send(products);
        });

        app.post('/booking', async (req, res) => {
            const product = req.body;
            const result = await bookingProductsCollection.insertOne(product);
            res.send(result);
        });

        // wishList
        app.get('/wishlist/:email', async (req, res) => {
            const email = req.params.email;
            const query = { buyer_email: email };
            const products = await wishListCollection.find(query).toArray();
            res.send(products);
        });

        app.post('/wishlist', async (req, res) => {
            const wishList = req.body;
            const result = await wishListCollection.insertOne(wishList);
            res.send(result);
        });

        app.delete('/wishlist/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await wishListCollection.deleteOne(filter);
            res.send(result);
        });


        app.get('/users/buyers', async (req, res) => {
            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/users/sellers', async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send(user);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);
            const query = { email: user.email };
            const isUserEmailAvailable = await usersCollection.findOne(query);
            if (!isUserEmailAvailable) {
                const result = await usersCollection.insertOne(user);
                return res.send(result);
            }
            res.send('Email Already Available');
        });

        app.put('/users/sellers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    seller_status: 'verified'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.delete('/users/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        // Product Category
        app.get('/category', async (req, res) => {
            const category = await categoryCollection.find({}).toArray();
            res.send(category);
        });

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { product_category_id: id, status: 'Available' };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });

        // Products
        app.get('/products', async (req, res) => {
            const query = { advertise: true, status: 'Available' };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });

        app.get('/products/:email', async (req, res) => {
            const email = req.params.email;
            const query = { seller_email: email };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });

        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        app.patch('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'Sold'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.put('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: true
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.delete('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        });

        // Payment
        app.get('/payment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await bookingProductsCollection.findOne(query);
            res.send(product);
        });
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.booking_id;
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transaction_id: payment.transaction_id
                }
            }
            const updatedResult = await bookingProductsCollection.updateOne(filter, updatedDoc);
            const productId = payment.product_id;
            const productUpdate = { _id: ObjectId(productId) };
            const productDoc = {
                $set: {
                    status: 'Sold'
                }
            }
            const products = await productsCollection.updateOne(productUpdate, productDoc);
            res.send(result);
        });

    }
    finally {

    }
}

run().catch(err => console.error(err));

app.listen(port, () => {
    console.log(`Server is running on PORT: ${port}`);
})