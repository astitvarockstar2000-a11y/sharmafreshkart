#!/usr/bin/env python3
"""
Backend API Test Suite for Sharma FreshKart
Tests all API endpoints with Supabase (Postgres) backend
"""

import requests
import json
import sys

# Base URL from environment
BASE_URL = "https://sharma-fresh-market.preview.emergentagent.com/api"

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"  Details: {details}")
    return passed

def test_config():
    """Test GET /api/config"""
    print("\n" + "="*60)
    print("TEST 1: GET /api/config")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/config", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            return print_test("Config endpoint", False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        if "whatsapp" not in data:
            return print_test("Config endpoint", False, "Missing 'whatsapp' field")
        
        if data["whatsapp"] != "919454361407":
            return print_test("Config endpoint", False, f"Expected whatsapp=919454361407, got {data['whatsapp']}")
        
        return print_test("Config endpoint", True, f"Returned correct WhatsApp: {data['whatsapp']}")
    
    except Exception as e:
        return print_test("Config endpoint", False, f"Exception: {str(e)}")

def test_seed():
    """Test POST /api/seed (idempotent)"""
    print("\n" + "="*60)
    print("TEST 2: POST /api/seed")
    print("="*60)
    
    try:
        # First seed
        response1 = requests.post(f"{BASE_URL}/seed", timeout=10)
        print(f"First seed - Status Code: {response1.status_code}")
        print(f"First seed - Response: {response1.text}")
        
        if response1.status_code != 200:
            return print_test("Seed endpoint", False, f"Expected 200, got {response1.status_code}")
        
        data1 = response1.json()
        if "seeded" not in data1 or data1["seeded"] != True:
            return print_test("Seed endpoint", False, "Missing or invalid 'seeded' field")
        
        # Second seed (test idempotency)
        response2 = requests.post(f"{BASE_URL}/seed", timeout=10)
        print(f"Second seed - Status Code: {response2.status_code}")
        print(f"Second seed - Response: {response2.text}")
        
        if response2.status_code != 200:
            return print_test("Seed endpoint", False, f"Second call failed with {response2.status_code}")
        
        data2 = response2.json()
        
        return print_test("Seed endpoint", True, f"Idempotent seeding works. First: {data1}, Second: {data2}")
    
    except Exception as e:
        return print_test("Seed endpoint", False, f"Exception: {str(e)}")

def test_categories():
    """Test GET /api/categories"""
    print("\n" + "="*60)
    print("TEST 3: GET /api/categories")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/categories", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}...")
        
        if response.status_code != 200:
            return print_test("Categories list", False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        if not isinstance(data, list):
            return print_test("Categories list", False, "Response is not an array")
        
        if len(data) != 8:
            return print_test("Categories list", False, f"Expected 8 categories, got {len(data)}")
        
        # Check required fields
        required_fields = ["id", "name", "slug", "sort_order"]
        for cat in data:
            for field in required_fields:
                if field not in cat:
                    return print_test("Categories list", False, f"Missing field '{field}' in category")
        
        # Check expected slugs
        expected_slugs = ["vegetables", "fruits", "grocery", "dairy", "daily-needs", "household", "apparels", "items-10"]
        actual_slugs = [cat["slug"] for cat in data]
        
        for slug in expected_slugs:
            if slug not in actual_slugs:
                return print_test("Categories list", False, f"Missing expected slug: {slug}")
        
        # Check ordering by sort_order
        sort_orders = [cat["sort_order"] for cat in data]
        if sort_orders != sorted(sort_orders):
            return print_test("Categories list", False, "Categories not ordered by sort_order")
        
        return print_test("Categories list", True, f"8 categories with correct slugs and ordering")
    
    except Exception as e:
        return print_test("Categories list", False, f"Exception: {str(e)}")

def test_products():
    """Test GET /api/products with various filters"""
    print("\n" + "="*60)
    print("TEST 4: GET /api/products (with filters)")
    print("="*60)
    
    all_passed = True
    
    # Test 4a: Get all products
    try:
        response = requests.get(f"{BASE_URL}/products", timeout=10)
        print(f"\n4a. All products - Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Products list (all)", False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            print(f"4a. Products count: {len(data)}")
            
            if len(data) < 10:
                print_test("Products list (all)", False, f"Expected >=10 products, got {len(data)}")
                all_passed = False
            else:
                # Check required fields
                required_fields = ["id", "category_slug", "name", "price", "unit", "image_url", "in_stock", "active"]
                if data:
                    for field in required_fields:
                        if field not in data[0]:
                            print_test("Products list (all)", False, f"Missing field '{field}'")
                            all_passed = False
                            break
                    else:
                        print_test("Products list (all)", True, f"{len(data)} products with all required fields")
    except Exception as e:
        print_test("Products list (all)", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 4b: Filter by category=fruits
    try:
        response = requests.get(f"{BASE_URL}/products?category=fruits", timeout=10)
        print(f"\n4b. Fruits filter - Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Products filter (category=fruits)", False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            print(f"4b. Fruits products count: {len(data)}")
            
            # Check all are fruits
            non_fruits = [p for p in data if p.get("category_slug") != "fruits"]
            if non_fruits:
                print_test("Products filter (category=fruits)", False, f"Found {len(non_fruits)} non-fruit products")
                all_passed = False
            else:
                print_test("Products filter (category=fruits)", True, f"{len(data)} fruits products only")
    except Exception as e:
        print_test("Products filter (category=fruits)", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 4c: Search by name (q=apple)
    try:
        response = requests.get(f"{BASE_URL}/products?q=apple", timeout=10)
        print(f"\n4c. Search q=apple - Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Products search (q=apple)", False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            print(f"4c. Search results: {len(data)}")
            
            # Check if "Fresh Apples" is in results
            apple_found = any("apple" in p.get("name", "").lower() for p in data)
            if not apple_found:
                print_test("Products search (q=apple)", False, "Fresh Apples not found in search results")
                all_passed = False
            else:
                print_test("Products search (q=apple)", True, f"Found apple products: {[p['name'] for p in data]}")
    except Exception as e:
        print_test("Products search (q=apple)", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 4d: Admin mode (includes inactive products)
    try:
        response = requests.get(f"{BASE_URL}/products?admin=1", timeout=10)
        print(f"\n4d. Admin mode - Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Products admin mode", False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            print(f"4d. Admin products count: {len(data)}")
            print_test("Products admin mode", True, f"Admin mode returns {len(data)} products (including inactive)")
    except Exception as e:
        print_test("Products admin mode", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_product_crud():
    """Test Product CRUD operations"""
    print("\n" + "="*60)
    print("TEST 5: Product CRUD (POST/PUT/DELETE)")
    print("="*60)
    
    created_id = None
    all_passed = True
    
    # Test 5a: Create product
    try:
        payload = {
            "category_slug": "grocery",
            "name": "Test Sugar",
            "price": 45,
            "unit": "1 kg",
            "image_url": None,
            "in_stock": True
        }
        response = requests.post(f"{BASE_URL}/products", json=payload, timeout=10)
        print(f"\n5a. Create product - Status Code: {response.status_code}")
        print(f"5a. Response: {response.text}")
        
        if response.status_code != 201:
            print_test("Product CREATE", False, f"Expected 201, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            if "id" not in data:
                print_test("Product CREATE", False, "No 'id' in response")
                all_passed = False
            else:
                created_id = data["id"]
                print_test("Product CREATE", True, f"Created product with ID: {created_id}")
    except Exception as e:
        print_test("Product CREATE", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 5b: Update product
    if created_id:
        try:
            payload = {
                "price": 50,
                "in_stock": False
            }
            response = requests.put(f"{BASE_URL}/products/{created_id}", json=payload, timeout=10)
            print(f"\n5b. Update product - Status Code: {response.status_code}")
            print(f"5b. Response: {response.text}")
            
            if response.status_code != 200:
                print_test("Product UPDATE", False, f"Expected 200, got {response.status_code}")
                all_passed = False
            else:
                data = response.json()
                if data.get("price") != 50 or data.get("in_stock") != False:
                    print_test("Product UPDATE", False, f"Update not reflected: price={data.get('price')}, in_stock={data.get('in_stock')}")
                    all_passed = False
                else:
                    print_test("Product UPDATE", True, f"Updated price to 50 and in_stock to false")
        except Exception as e:
            print_test("Product UPDATE", False, f"Exception: {str(e)}")
            all_passed = False
    
    # Test 5c: Delete product
    if created_id:
        try:
            response = requests.delete(f"{BASE_URL}/products/{created_id}", timeout=10)
            print(f"\n5c. Delete product - Status Code: {response.status_code}")
            print(f"5c. Response: {response.text}")
            
            if response.status_code != 200:
                print_test("Product DELETE", False, f"Expected 200, got {response.status_code}")
                all_passed = False
            else:
                data = response.json()
                if data.get("deleted") != created_id:
                    print_test("Product DELETE", False, f"Expected deleted={created_id}, got {data}")
                    all_passed = False
                else:
                    # Verify it's actually deleted
                    verify = requests.get(f"{BASE_URL}/products?admin=1", timeout=10)
                    products = verify.json()
                    still_exists = any(p["id"] == created_id for p in products)
                    if still_exists:
                        print_test("Product DELETE", False, "Product still exists after deletion")
                        all_passed = False
                    else:
                        print_test("Product DELETE", True, f"Product {created_id} successfully deleted")
        except Exception as e:
            print_test("Product DELETE", False, f"Exception: {str(e)}")
            all_passed = False
    
    return all_passed

def test_orders():
    """Test Orders create, list, and update"""
    print("\n" + "="*60)
    print("TEST 6: Orders (POST/GET/PUT)")
    print("="*60)
    
    created_order_id = None
    all_passed = True
    
    # Test 6a: Create order with valid data
    try:
        payload = {
            "customer_name": "Ravi Kumar",
            "phone": "9876543210",
            "fulfillment": "delivery",
            "address": "12 MG Road, Lucknow",
            "items": [
                {
                    "id": "test-id",
                    "name": "Fresh Tomatoes",
                    "price": 30,
                    "unit": "1 kg",
                    "qty": 2
                }
            ],
            "total": 60
        }
        response = requests.post(f"{BASE_URL}/orders", json=payload, timeout=10)
        print(f"\n6a. Create order - Status Code: {response.status_code}")
        print(f"6a. Response: {response.text}")
        
        if response.status_code != 201:
            print_test("Order CREATE (valid)", False, f"Expected 201, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            if "id" not in data:
                print_test("Order CREATE (valid)", False, "No 'id' in response")
                all_passed = False
            else:
                created_order_id = data["id"]
                if data.get("status") != "pending":
                    print_test("Order CREATE (valid)", False, f"Expected status=pending, got {data.get('status')}")
                    all_passed = False
                elif data.get("payment") != "cod":
                    print_test("Order CREATE (valid)", False, f"Expected payment=cod, got {data.get('payment')}")
                    all_passed = False
                else:
                    print_test("Order CREATE (valid)", True, f"Created order {created_order_id} with status=pending, payment=cod")
    except Exception as e:
        print_test("Order CREATE (valid)", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 6b: Create order without customer_name (should fail)
    try:
        payload = {
            "phone": "9876543210",
            "items": [],
            "total": 0
        }
        response = requests.post(f"{BASE_URL}/orders", json=payload, timeout=10)
        print(f"\n6b. Create order (missing name) - Status Code: {response.status_code}")
        print(f"6b. Response: {response.text}")
        
        if response.status_code != 400:
            print_test("Order CREATE (validation)", False, f"Expected 400, got {response.status_code}")
            all_passed = False
        else:
            print_test("Order CREATE (validation)", True, "Correctly rejected order without customer_name")
    except Exception as e:
        print_test("Order CREATE (validation)", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 6c: List orders
    try:
        response = requests.get(f"{BASE_URL}/orders", timeout=10)
        print(f"\n6c. List orders - Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Order LIST", False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            print(f"6c. Orders count: {len(data)}")
            
            if created_order_id:
                order_found = any(o["id"] == created_order_id for o in data)
                if not order_found:
                    print_test("Order LIST", False, f"Created order {created_order_id} not found in list")
                    all_passed = False
                else:
                    print_test("Order LIST", True, f"Found {len(data)} orders including created order")
            else:
                print_test("Order LIST", True, f"Retrieved {len(data)} orders")
    except Exception as e:
        print_test("Order LIST", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 6d: Update order status
    if created_order_id:
        try:
            payload = {"status": "confirmed"}
            response = requests.put(f"{BASE_URL}/orders/{created_order_id}", json=payload, timeout=10)
            print(f"\n6d. Update order status - Status Code: {response.status_code}")
            print(f"6d. Response: {response.text}")
            
            if response.status_code != 200:
                print_test("Order UPDATE", False, f"Expected 200, got {response.status_code}")
                all_passed = False
            else:
                data = response.json()
                if data.get("status") != "confirmed":
                    print_test("Order UPDATE", False, f"Expected status=confirmed, got {data.get('status')}")
                    all_passed = False
                else:
                    print_test("Order UPDATE", True, f"Updated order status to confirmed")
        except Exception as e:
            print_test("Order UPDATE", False, f"Exception: {str(e)}")
            all_passed = False
    
    return all_passed

def test_admin_login():
    """Test Admin login"""
    print("\n" + "="*60)
    print("TEST 7: Admin Login")
    print("="*60)
    
    all_passed = True
    
    # Test 7a: Correct password
    try:
        payload = {"password": "admin123"}
        response = requests.post(f"{BASE_URL}/admin/login", json=payload, timeout=10)
        print(f"\n7a. Login (correct) - Status Code: {response.status_code}")
        print(f"7a. Response: {response.text}")
        
        if response.status_code != 200:
            print_test("Admin login (correct)", False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            if data.get("success") != True:
                print_test("Admin login (correct)", False, f"Expected success=true, got {data}")
                all_passed = False
            else:
                print_test("Admin login (correct)", True, "Login successful with correct password")
    except Exception as e:
        print_test("Admin login (correct)", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 7b: Wrong password
    try:
        payload = {"password": "wrongpassword"}
        response = requests.post(f"{BASE_URL}/admin/login", json=payload, timeout=10)
        print(f"\n7b. Login (wrong) - Status Code: {response.status_code}")
        print(f"7b. Response: {response.text}")
        
        if response.status_code != 401:
            print_test("Admin login (wrong)", False, f"Expected 401, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            if data.get("success") != False:
                print_test("Admin login (wrong)", False, f"Expected success=false, got {data}")
                all_passed = False
            else:
                print_test("Admin login (wrong)", True, "Correctly rejected wrong password")
    except Exception as e:
        print_test("Admin login (wrong)", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SHARMA FRESHKART - BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results["config"] = test_config()
    results["seed"] = test_seed()
    results["categories"] = test_categories()
    results["products"] = test_products()
    results["product_crud"] = test_product_crud()
    results["orders"] = test_orders()
    results["admin_login"] = test_admin_login()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
