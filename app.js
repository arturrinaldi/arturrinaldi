const DEFAULT_SUPABASE_URL = "";
const DEFAULT_SUPABASE_ANON_KEY = "";

const STORAGE_KEY = "cookieManagerDataFallback";
const SUPABASE_CONFIG_KEY = "supabaseConfig";
const LOW_STOCK_LIMIT = 5;

const refs = {
  syncStatus: document.getElementById("syncStatus"),
  configForm: document.getElementById("configForm"),
  configUrl: document.getElementById("configSupabaseUrl"),
  configKey: document.getElementById("configSupabaseAnonKey"),
  clearConfigBtn: document.getElementById("clearConfigBtn"),
  productForm: document.getElementById("productForm"),
  ingredientForm: document.getElementById("ingredientForm"),
  saleForm: document.getElementById("saleForm"),
  saleDate: document.getElementById("saleDate"),
  ingredientDate: document.getElementById("ingredientDate"),
  saleProduct: document.getElementById("saleProduct"),
  quickSaleList: document.getElementById("quickSaleList"),
  productTableBody: document.getElementById("productTableBody"),
  totalRevenue: document.getElementById("totalRevenue"),
  totalCost: document.getElementById("totalCost"),
  totalProfit: document.getElementById("totalProfit"),
  lowStockCount: document.getElementById("lowStockCount"),
};

const today = new Date().toISOString().split("T")[0];
refs.saleDate.value = today;
refs.ingredientDate.value = today;

const state = { products: [], sales: [], ingredients: [] };
let db;
let profitChart;
let topProductsChart;

init();

async function init() {
  hydrateConfigForm();
  db = createDataProvider();

  refs.configForm.addEventListener("submit", handleSaveConfig);
  refs.clearConfigBtn.addEventListener("click", handleClearConfig);
  refs.productForm.addEventListener("submit", handleCreateProduct);
  refs.ingredientForm.addEventListener("submit", handleCreateIngredient);
  refs.saleForm.addEventListener("submit", handleCreateSale);
  refs.quickSaleList.addEventListener("click", handleQuickSale);
  refs.productTableBody.addEventListener("click", handleTableActions);

  await reloadData();
}

function hydrateConfigForm() {
  const config = getSupabaseConfig();
  refs.configUrl.value = config.url;
  refs.configKey.value = config.anonKey;
}

function getSupabaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
    return {
      url: saved?.url || DEFAULT_SUPABASE_URL,
      anonKey: saved?.anonKey || DEFAULT_SUPABASE_ANON_KEY,
    };
  } catch {
    return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
  }
}

function createDataProvider() {
  const config = getSupabaseConfig();

  if (config.url && config.anonKey) {
    refs.syncStatus.textContent = "Sincronizado com banco online (Supabase).";
    const client = window.supabase.createClient(config.url, config.anonKey);
    return createSupabaseProvider(client);
  }

  refs.syncStatus.textContent = "Modo fallback local (sem Supabase configurado).";
  return createLocalProvider();
}

async function handleSaveConfig(event) {
  event.preventDefault();

  const url = refs.configUrl.value.trim();
  const anonKey = refs.configKey.value.trim();

  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, anonKey }));
  db = createDataProvider();
  await reloadData();
  alert("Configuração salva. A sincronização foi atualizada.");
}

async function handleClearConfig() {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
  refs.configUrl.value = "";
  refs.configKey.value = "";
  db = createDataProvider();
  await reloadData();
  alert("Configuração removida. App voltou para modo local.");
}

function createSupabaseProvider(client) {
  return {
    async getAll() {
      const [{ data: products }, { data: sales }, { data: ingredients }] = await Promise.all([
        client.from("products").select("*").order("name"),
        client.from("sales").select("*").order("date", { ascending: false }),
        client.from("ingredients").select("*").order("date", { ascending: false }),
      ]);
      return { products: products ?? [], sales: sales ?? [], ingredients: ingredients ?? [] };
    },
    async addProduct(payload) {
      const { error } = await client.from("products").insert(payload);
      if (error) throw new Error(error.message);
    },
    async addIngredient(payload) {
      const { error } = await client.from("ingredients").insert(payload);
      if (error) throw new Error(error.message);
    },
    async registerSale({ product, quantity, date }) {
      const newStock = product.stock - quantity;
      if (newStock < 0) throw new Error("Estoque insuficiente");

      const { error: saleError } = await client.from("sales").insert({
        product_id: product.id,
        quantity,
        unit_price: product.price,
        total: product.price * quantity,
        date,
      });
      if (saleError) throw new Error(saleError.message);

      const { error: productError } = await client.from("products").update({ stock: newStock }).eq("id", product.id);
      if (productError) throw new Error(productError.message);
    },
    async deleteProduct(productId) {
      const { data: existingSales, error: checkError } = await client.from("sales").select("id").eq("product_id", productId).limit(1);
      if (checkError) throw new Error(checkError.message);
      if ((existingSales ?? []).length > 0) throw new Error("Este produto já possui vendas e não pode ser excluído.");

      const { error } = await client.from("products").delete().eq("id", productId);
      if (error) throw new Error(error.message);
    },
  };
}

function createLocalProvider() {
  const seed = {
    products: [
      { id: crypto.randomUUID(), name: "Cookie Tradicional", type: "Cookie", flavor: "Chocolate", price: 8, stock: 30 },
      { id: crypto.randomUUID(), name: "Biscoito Manteiga", type: "Biscoito", flavor: "Baunilha", price: 5, stock: 45 },
    ],
    sales: [],
    ingredients: [],
  };

  const load = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || structuredClone(seed);
  const save = (next) => localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  return {
    async getAll() { return load(); },
    async addProduct(payload) {
      const data = load();
      data.products.push({ id: crypto.randomUUID(), ...payload });
      save(data);
    },
    async addIngredient(payload) {
      const data = load();
      data.ingredients.push({ id: crypto.randomUUID(), ...payload });
      save(data);
    },
    async registerSale({ product, quantity, date }) {
      const data = load();
      const found = data.products.find((item) => item.id === product.id);
      if (!found || found.stock < quantity) throw new Error("Estoque insuficiente");
      found.stock -= quantity;
      data.sales.push({ id: crypto.randomUUID(), product_id: found.id, quantity, unit_price: found.price, total: found.price * quantity, date });
      save(data);
    },
    async deleteProduct(productId) {
      const data = load();
      if (data.sales.some((sale) => sale.product_id === productId)) throw new Error("Este produto já possui vendas e não pode ser excluído.");
      data.products = data.products.filter((product) => product.id !== productId);
      save(data);
    },
  };
}

async function handleCreateProduct(event) {
  event.preventDefault();
  try {
    await db.addProduct({
      name: document.getElementById("productName").value.trim(),
      type: document.getElementById("productType").value,
      flavor: document.getElementById("productFlavor").value.trim(),
      price: Number(document.getElementById("productPrice").value),
      stock: Number(document.getElementById("productStock").value),
    });
    event.target.reset();
    await reloadData();
  } catch (error) {
    alert(error.message || "Não foi possível salvar o produto.");
  }
}

async function handleCreateIngredient(event) {
  event.preventDefault();
  try {
    await db.addIngredient({
      name: document.getElementById("ingredientName").value.trim(),
      cost: Number(document.getElementById("ingredientCost").value),
      quantity: document.getElementById("ingredientQty").value.trim(),
      date: document.getElementById("ingredientDate").value,
    });
    event.target.reset();
    refs.ingredientDate.value = today;
    await reloadData();
  } catch (error) {
    alert(error.message || "Não foi possível registrar a compra.");
  }
}

async function handleCreateSale(event) {
  event.preventDefault();
  const productId = refs.saleProduct.value;
  const quantity = Number(document.getElementById("saleQuantity").value);
  await registerSale(productId, quantity);
  event.target.reset();
  refs.saleDate.value = today;
}

async function handleQuickSale(event) {
  const button = event.target.closest("button[data-product-id]");
  if (!button) return;
  await registerSale(button.dataset.productId, 1);
}

async function handleTableActions(event) {
  const button = event.target.closest("button[data-delete-product]");
  if (!button) return;

  const productId = button.dataset.deleteProduct;
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  if (!window.confirm(`Deseja excluir o produto "${product.name}"?`)) return;

  try {
    await db.deleteProduct(productId);
    await reloadData();
  } catch (error) {
    alert(error.message || "Não foi possível excluir o produto.");
  }
}

async function registerSale(productId, quantity) {
  const product = state.products.find((item) => item.id === productId);
  if (!product || quantity <= 0) return;

  try {
    await db.registerSale({ product, quantity, date: refs.saleDate.value || today });
    await reloadData();
  } catch (error) {
    alert(error.message || "Não foi possível registrar a venda.");
  }
}

async function reloadData() {
  const data = await db.getAll();
  state.products = data.products;
  state.sales = data.sales;
  state.ingredients = data.ingredients;
  renderAll();
}

function renderAll() {
  renderProductOptions();
  renderQuickSale();
  renderProductTable();
  renderSummary();
  renderCharts();
}

function renderProductOptions() {
  refs.saleProduct.innerHTML = "";
  state.products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} (${product.stock} un.)`;
    refs.saleProduct.appendChild(option);
  });
}

function renderQuickSale() {
  refs.quickSaleList.innerHTML = "";
  state.products.forEach((product) => {
    const item = document.createElement("div");
    item.className = "quick-item";
    item.innerHTML = `
      <div>
        <strong>${product.name}</strong><br />
        <small>Estoque: ${product.stock}</small>
      </div>
      <button type="button" data-product-id="${product.id}" ${product.stock <= 0 ? "disabled" : ""}>+1 venda</button>
    `;
    refs.quickSaleList.appendChild(item);
  });
}

function renderProductTable() {
  refs.productTableBody.innerHTML = "";
  state.products.forEach((product) => {
    const lowStockClass = product.stock <= LOW_STOCK_LIMIT ? "stock-low" : "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.type}</td>
      <td>${product.flavor}</td>
      <td>${toCurrency(product.price)}</td>
      <td class="${lowStockClass}">${product.stock}</td>
      <td><button type="button" class="danger-btn" data-delete-product="${product.id}">Excluir</button></td>
    `;
    refs.productTableBody.appendChild(row);
  });
}

function renderSummary() {
  const totalRevenue = state.sales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
  const totalCost = state.ingredients.reduce((acc, item) => acc + Number(item.cost || 0), 0);
  const lowStockCount = state.products.filter((p) => p.stock <= LOW_STOCK_LIMIT).length;

  refs.totalRevenue.textContent = toCurrency(totalRevenue);
  refs.totalCost.textContent = toCurrency(totalCost);
  refs.totalProfit.textContent = toCurrency(totalRevenue - totalCost);
  refs.lowStockCount.textContent = `${lowStockCount} itens`;
}

function renderCharts() {
  const monthly = getMonthlyData();
  const bestSellers = getBestSellers();

  if (profitChart) profitChart.destroy();
  if (topProductsChart) topProductsChart.destroy();

  profitChart = new Chart(document.getElementById("profitChart"), {
    type: "bar",
    data: {
      labels: monthly.labels,
      datasets: [
        { label: "Receita", data: monthly.revenue, backgroundColor: "rgba(91, 60, 196, 0.7)" },
        { label: "Gasto", data: monthly.cost, backgroundColor: "rgba(245, 158, 11, 0.7)" },
        { label: "Lucro", data: monthly.profit, type: "line", borderColor: "#16a34a", tension: 0.3 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  topProductsChart = new Chart(document.getElementById("topProductsChart"), {
    type: "doughnut",
    data: {
      labels: bestSellers.labels,
      datasets: [{ data: bestSellers.data, backgroundColor: ["#5b3cc4", "#f59e0b", "#16a34a", "#0891b2", "#d946ef"] }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("profitChart").style.minHeight = "300px";
  document.getElementById("topProductsChart").style.minHeight = "300px";
}

function getMonthlyData() {
  const keys = new Set();
  state.sales.forEach((sale) => keys.add(String(sale.date).slice(0, 7)));
  state.ingredients.forEach((item) => keys.add(String(item.date).slice(0, 7)));
  if (keys.size === 0) keys.add(new Date().toISOString().slice(0, 7));

  const labels = Array.from(keys).sort();
  const revenue = labels.map((month) => state.sales.filter((s) => String(s.date).startsWith(month)).reduce((acc, s) => acc + Number(s.total || 0), 0));
  const cost = labels.map((month) => state.ingredients.filter((i) => String(i.date).startsWith(month)).reduce((acc, i) => acc + Number(i.cost || 0), 0));
  const profit = labels.map((_, index) => revenue[index] - cost[index]);
  return { labels, revenue, cost, profit };
}

function getBestSellers() {
  const soldByProduct = new Map();
  state.sales.forEach((sale) => {
    soldByProduct.set(sale.product_id, (soldByProduct.get(sale.product_id) || 0) + Number(sale.quantity || 0));
  });

  const ranking = state.products
    .map((product) => ({ name: product.name, sold: soldByProduct.get(product.id) || 0 }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return { labels: ranking.map((i) => i.name), data: ranking.map((i) => i.sold) };
}

function toCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
