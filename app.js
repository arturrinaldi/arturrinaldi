const STORAGE_KEY = "cookieManagerData";

const seedData = {
  products: [
    {
      id: crypto.randomUUID(),
      name: "Cookie Tradicional",
      type: "Cookie",
      flavor: "Chocolate",
      price: 8,
      stock: 30,
    },
    {
      id: crypto.randomUUID(),
      name: "Biscoito Manteiga",
      type: "Biscoito",
      flavor: "Baunilha",
      price: 5,
      stock: 45,
    },
  ],
  sales: [],
  ingredients: [],
};

const state = loadState();

const refs = {
  productForm: document.getElementById("productForm"),
  ingredientForm: document.getElementById("ingredientForm"),
  saleForm: document.getElementById("saleForm"),
  saleDate: document.getElementById("saleDate"),
  ingredientDate: document.getElementById("ingredientDate"),
  saleProduct: document.getElementById("saleProduct"),
  productTableBody: document.getElementById("productTableBody"),
  totalRevenue: document.getElementById("totalRevenue"),
  totalCost: document.getElementById("totalCost"),
  totalProfit: document.getElementById("totalProfit"),
  lowStockCount: document.getElementById("lowStockCount"),
};

let profitChart;
let topProductsChart;

init();

function init() {
  const today = new Date().toISOString().split("T")[0];
  refs.saleDate.value = today;
  refs.ingredientDate.value = today;

  refs.productForm.addEventListener("submit", handleCreateProduct);
  refs.ingredientForm.addEventListener("submit", handleCreateIngredient);
  refs.saleForm.addEventListener("submit", handleCreateSale);

  renderAll();
}

function handleCreateProduct(event) {
  event.preventDefault();

  const product = {
    id: crypto.randomUUID(),
    name: document.getElementById("productName").value.trim(),
    type: document.getElementById("productType").value,
    flavor: document.getElementById("productFlavor").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    stock: Number(document.getElementById("productStock").value),
  };

  state.products.push(product);
  saveState();
  renderAll();
  event.target.reset();
}

function handleCreateIngredient(event) {
  event.preventDefault();

  state.ingredients.push({
    id: crypto.randomUUID(),
    name: document.getElementById("ingredientName").value.trim(),
    cost: Number(document.getElementById("ingredientCost").value),
    quantity: document.getElementById("ingredientQty").value.trim(),
    date: document.getElementById("ingredientDate").value,
  });

  saveState();
  renderAll();
  event.target.reset();
  refs.ingredientDate.value = new Date().toISOString().split("T")[0];
}

function handleCreateSale(event) {
  event.preventDefault();
  const productId = refs.saleProduct.value;
  const quantity = Number(document.getElementById("saleQuantity").value);
  const date = refs.saleDate.value;

  const product = state.products.find((item) => item.id === productId);

  if (!product || quantity <= 0) {
    return;
  }

  if (product.stock < quantity) {
    alert("Estoque insuficiente para esta venda.");
    return;
  }

  product.stock -= quantity;

  state.sales.push({
    id: crypto.randomUUID(),
    productId,
    quantity,
    unitPrice: product.price,
    total: product.price * quantity,
    date,
  });

  saveState();
  renderAll();
  event.target.reset();
  refs.saleDate.value = new Date().toISOString().split("T")[0];
}

function renderAll() {
  renderProductOptions();
  renderProductTable();
  renderSummary();
  renderCharts();
}

function renderProductOptions() {
  refs.saleProduct.innerHTML = "";

  if (!state.products.length) {
    const option = document.createElement("option");
    option.textContent = "Cadastre um produto primeiro";
    option.value = "";
    refs.saleProduct.appendChild(option);
    return;
  }

  state.products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} (${product.stock} un.)`;
    refs.saleProduct.appendChild(option);
  });
}

function renderProductTable() {
  refs.productTableBody.innerHTML = "";

  state.products.forEach((product) => {
    const row = document.createElement("tr");
    const lowStockClass = product.stock <= 5 ? "stock-low" : "";

    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.type}</td>
      <td>${product.flavor}</td>
      <td>${toCurrency(product.price)}</td>
      <td class="${lowStockClass}">${product.stock}</td>
    `;

    refs.productTableBody.appendChild(row);
  });
}

function renderSummary() {
  const totalRevenue = state.sales.reduce((acc, sale) => acc + sale.total, 0);
  const totalCost = state.ingredients.reduce((acc, item) => acc + item.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const lowStockCount = state.products.filter((p) => p.stock <= 5).length;

  refs.totalRevenue.textContent = toCurrency(totalRevenue);
  refs.totalCost.textContent = toCurrency(totalCost);
  refs.totalProfit.textContent = toCurrency(totalProfit);
  refs.lowStockCount.textContent = `${lowStockCount} itens`;
}

function renderCharts() {
  const monthly = getMonthlyData();
  const bestSellers = getBestSellers();

  if (profitChart) {
    profitChart.destroy();
  }
  if (topProductsChart) {
    topProductsChart.destroy();
  }

  profitChart = new Chart(document.getElementById("profitChart"), {
    type: "bar",
    data: {
      labels: monthly.labels,
      datasets: [
        {
          label: "Receita",
          data: monthly.revenue,
          backgroundColor: "rgba(91, 60, 196, 0.7)",
        },
        {
          label: "Gasto",
          data: monthly.cost,
          backgroundColor: "rgba(245, 158, 11, 0.7)",
        },
        {
          label: "Lucro",
          data: monthly.profit,
          type: "line",
          borderColor: "rgba(22, 163, 74, 1)",
          backgroundColor: "rgba(22, 163, 74, 0.2)",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  topProductsChart = new Chart(document.getElementById("topProductsChart"), {
    type: "doughnut",
    data: {
      labels: bestSellers.labels,
      datasets: [
        {
          label: "Vendas",
          data: bestSellers.data,
          backgroundColor: ["#5b3cc4", "#f59e0b", "#16a34a", "#0891b2", "#d946ef"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  document.getElementById("profitChart").style.minHeight = "300px";
  document.getElementById("topProductsChart").style.minHeight = "300px";
}

function getMonthlyData() {
  const keys = new Set();

  state.sales.forEach((sale) => keys.add(sale.date.slice(0, 7)));
  state.ingredients.forEach((item) => keys.add(item.date.slice(0, 7)));

  if (keys.size === 0) {
    const current = new Date().toISOString().slice(0, 7);
    keys.add(current);
  }

  const labels = Array.from(keys).sort();

  const revenue = labels.map((month) =>
    state.sales
      .filter((sale) => sale.date.startsWith(month))
      .reduce((acc, sale) => acc + sale.total, 0)
  );

  const cost = labels.map((month) =>
    state.ingredients
      .filter((item) => item.date.startsWith(month))
      .reduce((acc, item) => acc + item.cost, 0)
  );

  const profit = labels.map((_, index) => revenue[index] - cost[index]);

  return {
    labels,
    revenue,
    cost,
    profit,
  };
}

function getBestSellers() {
  const soldByProduct = new Map();

  state.sales.forEach((sale) => {
    soldByProduct.set(sale.productId, (soldByProduct.get(sale.productId) || 0) + sale.quantity);
  });

  const ranking = state.products
    .map((product) => ({
      name: product.name,
      sold: soldByProduct.get(product.id) || 0,
    }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return {
    labels: ranking.map((item) => item.name),
    data: ranking.map((item) => item.sold),
  };
}

function toCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return structuredClone(seedData);
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      products: parsed.products ?? [],
      sales: parsed.sales ?? [],
      ingredients: parsed.ingredients ?? [],
    };
  } catch {
    return structuredClone(seedData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
