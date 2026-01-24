# HTTP Client Request Files

This directory contains `.http` files for manual API testing using HTTP clients like PyCharm, IntelliJ IDEA, VS Code (with REST Client extension), or any tool that supports the HTTP request file format.

## Quick Start

### 1. Setup Environment File

Copy the example environment file:

```bash
cd apps/example-service/requests
cp http-client.env.json.example http-client.env.json
```

### 2. Generate JWT Tokens

The service requires JWT tokens for authentication. Generate tokens using Node.js:

**Admin Token** (can create, update, delete products):

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'admin-user-123',email:'admin@example.com',name:'Admin User',roles:['admin','user']}, 'dev-secret-change-in-production-at-least-32-chars', {expiresIn:'24h'}))"
```

**User Token** (can only view products):

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'user-456',email:'user@example.com',name:'Regular User',roles:['user']}, 'dev-secret-change-in-production-at-least-32-chars', {expiresIn:'24h'}))"
```

### 3. Update Environment File

Edit `http-client.env.json` and paste your generated tokens:

```json
{
  "dev": {
    "baseUrl": "http://localhost:8000",
    "adminToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "productId": "REPLACE_AFTER_CREATING_PRODUCT"
  }
}
```

### 4. Start the Service

```bash
# From monorepo root
pnpm dev

# Or from example-service directory
cd apps/example-service
pnpm dev
```

The service will start at `http://localhost:8000`.

### 5. Run Requests

Open any `.http` file in your IDE and click the "Run" button next to a request.

## Available Request Files

| File            | Description                          | Auth Required |
| --------------- | ------------------------------------ | ------------- |
| `root.http`     | Root endpoint - returns service info | No            |
| `health.http`   | Health check endpoint                | No            |
| `auth.http`     | Token generation instructions        | N/A           |
| `products.http` | Complete product CRUD operations     | Yes           |

## Using the HTTP Files

### PyCharm / IntelliJ IDEA

1. Open any `.http` file
2. Click the green "Run" arrow (▶) next to a request
3. View response in the "Run" tool window
4. The IDE automatically loads variables from `http-client.env.json`

### VS Code (REST Client Extension)

1. Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
2. Open any `.http` file
3. Click "Send Request" above each request
4. Create `.vscode/settings.json` with environment variables:

```json
{
  "rest-client.environmentVariables": {
    "dev": {
      "baseUrl": "http://localhost:8000",
      "adminToken": "YOUR_ADMIN_TOKEN",
      "userToken": "YOUR_USER_TOKEN",
      "productId": "YOUR_PRODUCT_ID"
    }
  }
}
```

## Example Workflow

### 1. Test Public Endpoints

```http
# No authentication needed
GET http://localhost:8000/
GET http://localhost:8000/health
```

### 2. Create a Product (Admin Only)

```http
POST http://localhost:8000/products
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "Wireless Mouse",
  "description": "Ergonomic wireless mouse",
  "sku": "MOUSE-001",
  "price": 29.99,
  "stock": 100
}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Wireless Mouse",
  "sku": "MOUSE-001",
  "price": 29.99,
  "stock": 100,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 3. Update Environment File with Product ID

Copy the `id` from the response and update `http-client.env.json`:

```json
{
  "dev": {
    "productId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 4. View Products (Any Authenticated User)

```http
GET http://localhost:8000/products
Authorization: Bearer {{userToken}}
```

### 5. Update Product (Admin Only)

```http
PATCH http://localhost:8000/products/{{productId}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "price": 24.99,
  "stock": 150
}
```

### 6. Delete Product (Admin Only)

```http
DELETE http://localhost:8000/products/{{productId}}
Authorization: Bearer {{adminToken}}
```

## Environment Variables Reference

| Variable     | Description               | Example                                |
| ------------ | ------------------------- | -------------------------------------- |
| `baseUrl`    | API base URL              | `http://localhost:8000`                |
| `adminToken` | JWT token with admin role | `eyJhbGciOiJIUzI1NiIs...`              |
| `userToken`  | JWT token with user role  | `eyJhbGciOiJIUzI1NiIs...`              |
| `productId`  | Product ID for testing    | `550e8400-e29b-41d4-a716-446655440000` |

## Authentication & Authorization

### Token Roles

- **Admin** (`roles: ['admin', 'user']`): Can create, update, and delete products
- **User** (`roles: ['user']`): Can only view products

### Token Structure

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "roles": ["admin", "user"],
  "iat": 1234567890,
  "exp": 1234654290
}
```

### JWT Secret

The JWT secret must match the `JWT_SECRET` in your `.env` file:

```env
# .env
JWT_SECRET=dev-secret-change-in-production-at-least-32-chars
```

### Token Expiration

Tokens expire after 24 hours by default. Generate new tokens when they expire.

## Error Testing

The `products.http` file includes error case examples:

- **401 Unauthorized**: Request without token
- **403 Forbidden**: User role trying to create product
- **400 Bad Request**: Invalid data (negative price)
- **404 Not Found**: Product doesn't exist
- **409 Conflict**: Duplicate SKU

## Tips

1. **Token Expiration**: Tokens expire after 24h. Generate new ones when needed.
2. **Product IDs**: After creating a product, update `productId` in `http-client.env.json`.
3. **Pagination**: Use `?limit=10&offset=0` query parameters on GET /products.
4. **Environment Switching**: Use `"dev"` or `"production"` environments in `http-client.env.json`.
5. **Response Validation**: Check HTTP status codes and response bodies for expected results.

## Troubleshooting

### 401 Unauthorized

- Verify token is correctly copied to `http-client.env.json`
- Check token hasn't expired (generate new one)
- Ensure JWT_SECRET matches the one used to generate token

### 403 Forbidden

- Verify you're using admin token for create/update/delete operations
- Check token payload includes correct roles

### 404 Not Found

- Verify product ID exists (create a product first)
- Update `productId` in `http-client.env.json` with actual ID

### Connection Refused

- Ensure service is running (`pnpm dev`)
- Check service is listening on correct port (default: 8000)
- Verify `baseUrl` in `http-client.env.json` is correct

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Service architecture and design patterns
- [CONFIG.md](../CONFIG.md) - Configuration and environment variables
- [.env.example](../.env.example) - Environment variable template

## API Documentation

For interactive API documentation, visit the Swagger UI when the service is running:

```
http://localhost:8000/api
```
