const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "database", "books.db");

let db;

const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: databasePath,
            driver: sqlite3.Database,
        });

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error(`Database connection failed: ${error.message}`);
        process.exit(1);
    }
};

initializeDBAndServer();

// GET all books with search, sorting, pagination and price filtering
app.get("/books", async (request, response) => {
    try {
        const {
            search_q = "",
            order_by = "id",
            order = "ASC",
            limit = 10,
            offset = 0,
            min_price,
            max_price
        } = request.query;

        const validColumns = ["id", "title", "author", "price", "pages"];

        const sortColumn = validColumns.includes(order_by)
            ? order_by
            : "id";

        const sortOrder = order.toUpperCase() === "DESC"
            ? "DESC"
            : "ASC";

        let query = "SELECT * FROM book";
        let conditions = [];
        let params = [];

        if (search_q) {
            conditions.push("title LIKE ?");
            params.push(`%${search_q}%`);
        }

        if (min_price !== undefined) {
            conditions.push("price >= ?");
            params.push(Number(min_price));
        }

        if (max_price !== undefined) {
            conditions.push("price <= ?");
            params.push(Number(max_price));
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;

        params.push(Number(limit), Number(offset));

        const books = await db.all(query, params);

        response.status(200).json(books);

    } catch (error) {
        response.status(500).json({
            message: "Failed to retrieve books"
        });
    }
});

// GET a book by ID
app.get("/books/:bookId", async (request, response) => {
    try {
        const { bookId } = request.params;

        const book = await db.get(
            "SELECT * FROM book WHERE id = ?",
            bookId
        );

        if (!book) {
            return response.status(404).json({
                message: "Book not found"
            });
        }

        response.status(200).json(book);

    } catch (error) {
        response.status(500).json({
            message: "Failed to retrieve book"
        });
    }
});

// POST a new book
app.post("/books", async (request, response) => {
    try {
        const { title, author, price, pages } = request.body;

        // Validate title
        if (!title) {
            return response.status(400).json({
                message: "Title is required"
            });
        }

        // Validate author
        if (!author) {
            return response.status(400).json({
                message: "Author is required"
            });
        }

        // Validate price
        if (
            price === undefined ||
            price === null ||
            price === "" ||
            !Number.isFinite(Number(price))
        ) {
            return response.status(400).json({
                message: "Price must be a valid number"
            });
        }

        const result = await db.run(
            `INSERT INTO book (title, author, price, pages)
             VALUES (?, ?, ?, ?)`,
            title,
            author,
            Number(price),
            pages
        );

        response.status(201).json({
            message: "Book created successfully",
            id: result.lastID
        });

    } catch (error) {
        response.status(500).json({
            message: "Failed to create book"
        });
    }
});

// PUT (update) a book
app.put("/books/:bookId", async (request, response) => {
    try {
        const { bookId } = request.params;
        const { title, author, price, pages } = request.body;

        const result = await db.run(
            `UPDATE book
             SET title = ?, author = ?, price = ?, pages = ?
             WHERE id = ?`,
            title,
            author,
            price,
            pages,
            bookId
        );

        if (result.changes === 0) {
            return response.status(404).json({
                message: "Book not found"
            });
        }

        response.status(200).json({
            message: "Book updated successfully"
        });

    } catch (error) {
        response.status(500).json({
            message: "Failed to update book"
        });
    }
});

// DELETE a book
app.delete("/books/:bookId", async (request, response) => {
    try {
        const { bookId } = request.params;

        const result = await db.run(
            "DELETE FROM book WHERE id = ?",
            bookId
        );

        if (result.changes === 0) {
            return response.status(404).json({
                message: "Book not found"
            });
        }

        response.status(200).json({
            message: "Book deleted successfully"
        });

    } catch (error) {
        response.status(500).json({
            message: "Failed to delete book"
        });
    }
});

module.exports = app;
