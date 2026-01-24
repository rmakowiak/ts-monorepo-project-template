# HTTP Client Request Files

Manual API testing using `.http` files compatible with PyCharm, IntelliJ IDEA, VS Code (REST Client extension), and other HTTP clients.

## Quick Start

```bash
# 1. Setup environment
cd apps/example-service/requests
cp http-client.env.json.example http-client.env.json

# 2. Generate JWT tokens
node -e "console.log(require('jsonwebtoken').sign({sub:'admin-123',email:'admin@example.com',name:'Admin',roles:['admin','user']}, 'dev-secret-change-in-production-at-least-32-chars', {expiresIn:'24h'}))"

# 3. Paste token into http-client.env.json
# 4. Start service
pnpm dev

# 5. Open any .http file and click "Run"
```

## Available Files

| File            | Description            | Auth |
| --------------- | ---------------------- | ---- |
| `root.http`     | Service info endpoint  | No   |
| `health.http`   | Health check           | No   |
| `auth.http`     | Token generation guide | N/A  |
| `products.http` | Full product CRUD      | Yes  |

## Environment Setup

Edit `http-client.env.json`:

```json
{
  "dev": {
    "baseUrl": "http://localhost:8000",
    "adminToken": "YOUR_ADMIN_TOKEN_HERE",
    "userToken": "YOUR_USER_TOKEN_HERE",
    "productId": "REPLACE_AFTER_CREATING_PRODUCT"
  }
}
```

### Generate Tokens

**Admin** (create, update, delete products):

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'admin-123',email:'admin@example.com',name:'Admin',roles:['admin','user']}, 'dev-secret-change-in-production-at-least-32-chars', {expiresIn:'24h'}))"
```

**User** (view only):

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'user-456',email:'user@example.com',name:'User',roles:['user']}, 'dev-secret-change-in-production-at-least-32-chars', {expiresIn:'24h'}))"
```

## Example Workflow

1. **Test public endpoints** (no auth):

   ```http
   GET http://localhost:8000/
   GET http://localhost:8000/health
   ```

2. **Create product** (admin only):

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

3. **Copy product ID** from response and update `http-client.env.json`

4. **View products** (any authenticated user):

   ```http
   GET http://localhost:8000/products
   Authorization: Bearer {{userToken}}
   ```

5. **Update product** (admin only):

   ```http
   PATCH http://localhost:8000/products/{{productId}}
   Authorization: Bearer {{adminToken}}
   Content-Type: application/json

   {"price": 24.99}
   ```

6. **Delete product** (admin only):
   ```http
   DELETE http://localhost:8000/products/{{productId}}
   Authorization: Bearer {{adminToken}}
   ```

## Using with IDEs

### PyCharm / IntelliJ IDEA

1. Open any `.http` file
2. Click green "Run" arrow (▶) next to request
3. View response in "Run" tool window
4. Variables automatically loaded from `http-client.env.json`

### VS Code (REST Client Extension)

1. Install [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
2. Open any `.http` file
3. Click "Send Request" above each request
4. Create `.vscode/settings.json`:
   ```json
   {
     "rest-client.environmentVariables": {
       "dev": {
         "baseUrl": "http://localhost:8000",
         "adminToken": "YOUR_TOKEN",
         "userToken": "YOUR_TOKEN",
         "productId": "YOUR_PRODUCT_ID"
       }
     }
   }
   ```

## Environment Variables

| Variable     | Description            | Example                   |
| ------------ | ---------------------- | ------------------------- |
| `baseUrl`    | API base URL           | `http://localhost:8000`   |
| `adminToken` | JWT with admin role    | `eyJhbGciOiJIUzI1NiIs...` |
| `userToken`  | JWT with user role     | `eyJhbGciOiJIUzI1NiIs...` |
| `productId`  | Product ID for testing | `550e8400-e29b-41d4-...`  |

## Authentication

### Roles

- **Admin** (`roles: ['admin', 'user']`): Full CRUD access
- **User** (`roles: ['user']`): Read-only access

### Token Structure

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "roles": ["admin", "user"],
  "exp": 1234654290
}
```

JWT secret must match `JWT_SECRET` in `.env` file.

## Error Testing

Examples included in `products.http`:

- **401 Unauthorized**: Missing token
- **403 Forbidden**: Wrong role (user trying to create)
- **400 Bad Request**: Invalid data (negative price)
- **404 Not Found**: Product doesn't exist
- **409 Conflict**: Duplicate SKU

## Troubleshooting

**401 Unauthorized**

- Verify token in `http-client.env.json`
- Token may be expired (generate new one)
- Check JWT_SECRET matches

**403 Forbidden**

- Use admin token for create/update/delete
- Verify token includes correct roles

**404 Not Found**

- Create a product first
- Update `productId` in `http-client.env.json`

**Connection Refused**

- Ensure service is running: `pnpm dev`
- Check port (default: 8000)
- Verify `baseUrl` in config/

## Related Docs

- [README.md](../README.md) - Service overview
- [CONFIG.md](../CONFIG.md) - Configuration guide
- [CLAUDE.md](../CLAUDE.md) - Architecture details
- Swagger UI: http://localhost:8000/api
