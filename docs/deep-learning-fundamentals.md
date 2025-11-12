# 🧠 FUNDAMENTOS DE DEEP LEARNING

> **Documento Complementar**: Conceitos essenciais e matemática fundamental

---

## 📚 MATEMÁTICA ESSENCIAL

### 1. Álgebra Linear

**Vetores e Matrizes**:

```
Vetor: x = [x₁, x₂, ..., xₙ]
Matriz: A = [[a₁₁, a₁₂], [a₂₁, a₂₂]]
```

**Operações Fundamentais**:

```python
# Produto escalar
dot_product = x₁y₁ + x₂y₂ + ... + xₙyₙ

# Multiplicação matriz-vetor
Ax = [Σ(aᵢⱼxⱼ) for i in rows]

# Norma L2
||x||₂ = √(x₁² + x₂² + ... + xₙ²)
```

**Por que importa**: Redes neurais são operações matriciais massivas

### 2. Cálculo Diferencial

**Derivadas Básicas**:

```
d/dx(xⁿ) = nxⁿ⁻¹
d/dx(eˣ) = eˣ
d/dx(ln(x)) = 1/x
d/dx(sin(x)) = cos(x)
```

**Regra da Cadeia**:

```
Se y = f(g(x)), então dy/dx = f'(g(x)) × g'(x)
```

**Gradiente**:

```
∇f = [∂f/∂x₁, ∂f/∂x₂, ..., ∂f/∂xₙ]
```

**Por que importa**: Backpropagation é aplicação da regra da cadeia

### 3. Probabilidade e Estatística

**Distribuições Importantes**:

```python
# Normal (Gaussiana)
p(x) = (1/√(2πσ²)) × exp(-(x-μ)²/(2σ²))

# Bernoulli
p(x) = pˣ(1-p)¹⁻ˣ

# Categórica (Multinomial)
p(x = k) = πₖ onde Σπₖ = 1
```

**Conceitos Chave**:

- **Esperança**: E[X] = Σ x × p(x)
- **Variância**: Var[X] = E[(X - E[X])²]
- **Entropia**: H(X) = -Σ p(x) log p(x)

---

## 🔢 FUNÇÕES DE ATIVAÇÃO DETALHADAS

### Sigmoid

```python
def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def sigmoid_derivative(x):
    s = sigmoid(x)
    return s * (1 - s)
```

**Características**:

- Range: (0, 1)
- Suave e diferenciável
- Interpretação probabilística
- **Problema**: Vanishing gradient para |x| > 3

### Tanh

```python
def tanh(x):
    return np.tanh(x)

def tanh_derivative(x):
    return 1 - np.tanh(x)**2
```

**Características**:

- Range: (-1, 1)
- Centrada em zero (melhor que sigmoid)
- **Problema**: Ainda sofre vanishing gradient

### ReLU

```python
def relu(x):
    return np.maximum(0, x)

def relu_derivative(x):
    return (x > 0).astype(float)
```

**Características**:

- Range: [0, ∞)
- Computacionalmente eficiente
- Não satura para valores positivos
- **Problema**: "Dying ReLU" (neurônios morrem)

### Leaky ReLU

```python
def leaky_relu(x, alpha=0.01):
    return np.where(x > 0, x, alpha * x)

def leaky_relu_derivative(x, alpha=0.01):
    return np.where(x > 0, 1, alpha)
```

**Vantagem**: Resolve dying ReLU

### ELU (Exponential Linear Unit)

```python
def elu(x, alpha=1.0):
    return np.where(x > 0, x, alpha * (np.exp(x) - 1))
```

**Características**:

- Suave em toda parte
- Média das ativações próxima de zero
- Convergência mais rápida

### Swish/SiLU

```python
def swish(x):
    return x * sigmoid(x)
```

**Características**:

- Descoberta por Neural Architecture Search
- Performance superior em redes profundas
- Suave e não-monótona

### GELU (Gaussian Error Linear Unit)

```python
def gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2/np.pi) * (x + 0.044715 * x**3)))
```

**Uso**: Transformers (BERT, GPT)

---

## 📊 LOSS FUNCTIONS DETALHADAS

### Mean Squared Error (MSE)

```python
def mse_loss(y_true, y_pred):
    return np.mean((y_true - y_pred)**2)

def mse_gradient(y_true, y_pred):
    return 2 * (y_pred - y_true) / len(y_true)
```

**Uso**: Regressão
**Características**: Penaliza erros grandes quadraticamente

### Mean Absolute Error (MAE)

```python
def mae_loss(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))
```

**Uso**: Regressão robusta a outliers
**Características**: Penalização linear

### Cross-Entropy

```python
def cross_entropy(y_true, y_pred):
    # Evita log(0)
    y_pred = np.clip(y_pred, 1e-15, 1 - 1e-15)
    return -np.sum(y_true * np.log(y_pred))

def cross_entropy_gradient(y_true, y_pred):
    return y_pred - y_true
```

**Uso**: Classificação
**Por que funciona**: Maximiza likelihood

### Binary Cross-Entropy

```python
def binary_cross_entropy(y_true, y_pred):
    y_pred = np.clip(y_pred, 1e-15, 1 - 1e-15)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
```

### Focal Loss

```python
def focal_loss(y_true, y_pred, alpha=1, gamma=2):
    ce = cross_entropy(y_true, y_pred)
    p_t = y_pred * y_true + (1 - y_pred) * (1 - y_true)
    return alpha * (1 - p_t)**gamma * ce
```

**Uso**: Datasets desbalanceados
**Ideia**: Foca em exemplos difíceis

---

## 🎯 INICIALIZAÇÃO DE PESOS

### Por que Inicialização Importa?

**Zeros**: Todos os neurônios aprendem a mesma coisa
**Muito grande**: Saturação das ativações
**Muito pequeno**: Gradientes muito pequenos

### Xavier/Glorot Initialization

```python
def xavier_uniform(fan_in, fan_out):
    limit = np.sqrt(6 / (fan_in + fan_out))
    return np.random.uniform(-limit, limit, (fan_out, fan_in))

def xavier_normal(fan_in, fan_out):
    std = np.sqrt(2 / (fan_in + fan_out))
    return np.random.normal(0, std, (fan_out, fan_in))
```

**Uso**: Sigmoid, Tanh
**Objetivo**: Manter variância das ativações

### He Initialization

```python
def he_uniform(fan_in, fan_out):
    limit = np.sqrt(6 / fan_in)
    return np.random.uniform(-limit, limit, (fan_out, fan_in))

def he_normal(fan_in, fan_out):
    std = np.sqrt(2 / fan_in)
    return np.random.normal(0, std, (fan_out, fan_in))
```

**Uso**: ReLU e variantes
**Objetivo**: Compensa o fato de ReLU zerar metade das ativações

### LeCun Initialization

```python
def lecun_normal(fan_in, fan_out):
    std = np.sqrt(1 / fan_in)
    return np.random.normal(0, std, (fan_out, fan_in))
```

**Uso**: SELU activation

---

## 🔄 BACKPROPAGATION DETALHADO

### Implementação Passo a Passo

```python
class SimpleNetwork:
    def __init__(self, input_size, hidden_size, output_size):
        # Inicialização He
        self.W1 = np.random.randn(input_size, hidden_size) * np.sqrt(2/input_size)
        self.b1 = np.zeros((1, hidden_size))
        self.W2 = np.random.randn(hidden_size, output_size) * np.sqrt(2/hidden_size)
        self.b2 = np.zeros((1, output_size))

    def forward(self, X):
        # Camada 1
        self.z1 = np.dot(X, self.W1) + self.b1
        self.a1 = np.maximum(0, self.z1)  # ReLU

        # Camada 2
        self.z2 = np.dot(self.a1, self.W2) + self.b2
        self.a2 = self.softmax(self.z2)

        return self.a2

    def backward(self, X, y, output):
        m = X.shape[0]

        # Gradientes da camada de saída
        dz2 = output - y
        dW2 = (1/m) * np.dot(self.a1.T, dz2)
        db2 = (1/m) * np.sum(dz2, axis=0, keepdims=True)

        # Gradientes da camada oculta
        da1 = np.dot(dz2, self.W2.T)
        dz1 = da1 * (self.z1 > 0)  # Derivada ReLU
        dW1 = (1/m) * np.dot(X.T, dz1)
        db1 = (1/m) * np.sum(dz1, axis=0, keepdims=True)

        return dW1, db1, dW2, db2

    def softmax(self, z):
        exp_z = np.exp(z - np.max(z, axis=1, keepdims=True))
        return exp_z / np.sum(exp_z, axis=1, keepdims=True)
```

### Verificação de Gradientes

```python
def gradient_check(network, X, y, epsilon=1e-7):
    """Verifica se gradientes estão corretos usando diferenças finitas"""

    # Forward pass
    output = network.forward(X)
    dW1, db1, dW2, db2 = network.backward(X, y, output)

    # Função de loss
    def compute_loss():
        pred = network.forward(X)
        return -np.mean(np.sum(y * np.log(pred + 1e-15), axis=1))

    # Verifica W1
    for i in range(min(10, network.W1.size)):  # Testa apenas alguns
        # Gradiente numérico
        network.W1.flat[i] += epsilon
        loss_plus = compute_loss()
        network.W1.flat[i] -= 2 * epsilon
        loss_minus = compute_loss()
        network.W1.flat[i] += epsilon  # Restaura

        numerical_grad = (loss_plus - loss_minus) / (2 * epsilon)
        analytical_grad = dW1.flat[i]

        diff = abs(numerical_grad - analytical_grad)
        if diff > 1e-5:
            print(f"Gradient check failed: {diff}")
            return False

    print("Gradient check passed!")
    return True
```

---

## 📈 MÉTRICAS DE AVALIAÇÃO

### Classificação

**Accuracy**:

```python
def accuracy(y_true, y_pred):
    return np.mean(y_true == y_pred)
```

**Precision, Recall, F1**:

```python
def precision_recall_f1(y_true, y_pred, class_id):
    tp = np.sum((y_true == class_id) & (y_pred == class_id))
    fp = np.sum((y_true != class_id) & (y_pred == class_id))
    fn = np.sum((y_true == class_id) & (y_pred != class_id))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return precision, recall, f1
```

**AUC-ROC**:

```python
def auc_roc(y_true, y_scores):
    # Ordena por score decrescente
    indices = np.argsort(y_scores)[::-1]
    y_true_sorted = y_true[indices]

    # Calcula TPR e FPR para diferentes thresholds
    tpr, fpr = [], []
    tp = fp = 0

    for i, label in enumerate(y_true_sorted):
        if label == 1:
            tp += 1
        else:
            fp += 1

        tpr.append(tp / np.sum(y_true))
        fpr.append(fp / np.sum(1 - y_true))

    # Calcula AUC usando regra do trapézio
    return np.trapz(tpr, fpr)
```

### Regressão

**R² Score**:

```python
def r2_score(y_true, y_pred):
    ss_res = np.sum((y_true - y_pred)**2)
    ss_tot = np.sum((y_true - np.mean(y_true))**2)
    return 1 - (ss_res / ss_tot)
```

**MAPE (Mean Absolute Percentage Error)**:

```python
def mape(y_true, y_pred):
    return np.mean(np.abs((y_true - y_pred) / y_true)) * 100
```

---

## 🛠️ IMPLEMENTAÇÃO DE OTIMIZADORES

### SGD com Momentum

```python
class SGDMomentum:
    def __init__(self, learning_rate=0.01, momentum=0.9):
        self.lr = learning_rate
        self.momentum = momentum
        self.velocities = {}

    def update(self, params, grads):
        for key in params:
            if key not in self.velocities:
                self.velocities[key] = np.zeros_like(params[key])

            self.velocities[key] = (self.momentum * self.velocities[key] -
                                   self.lr * grads[key])
            params[key] += self.velocities[key]
```

### Adam

```python
class Adam:
    def __init__(self, learning_rate=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8):
        self.lr = learning_rate
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.m = {}  # Primeiro momento
        self.v = {}  # Segundo momento
        self.t = 0   # Contador de iterações

    def update(self, params, grads):
        self.t += 1

        for key in params:
            if key not in self.m:
                self.m[key] = np.zeros_like(params[key])
                self.v[key] = np.zeros_like(params[key])

            # Atualiza momentos
            self.m[key] = self.beta1 * self.m[key] + (1 - self.beta1) * grads[key]
            self.v[key] = self.beta2 * self.v[key] + (1 - self.beta2) * grads[key]**2

            # Correção de viés
            m_hat = self.m[key] / (1 - self.beta1**self.t)
            v_hat = self.v[key] / (1 - self.beta2**self.t)

            # Atualização
            params[key] -= self.lr * m_hat / (np.sqrt(v_hat) + self.epsilon)
```

---

## 🎲 TÉCNICAS DE REGULARIZAÇÃO

### Dropout Implementação

```python
def dropout_forward(x, dropout_rate, training=True):
    if not training:
        return x

    mask = (np.random.rand(*x.shape) > dropout_rate).astype(np.float32)
    return x * mask / (1 - dropout_rate)

def dropout_backward(dout, mask, dropout_rate):
    return dout * mask / (1 - dropout_rate)
```

### Batch Normalization

```python
class BatchNorm:
    def __init__(self, num_features, eps=1e-5, momentum=0.1):
        self.eps = eps
        self.momentum = momentum

        # Parâmetros aprendíveis
        self.gamma = np.ones(num_features)
        self.beta = np.zeros(num_features)

        # Estatísticas para inferência
        self.running_mean = np.zeros(num_features)
        self.running_var = np.ones(num_features)

    def forward(self, x, training=True):
        if training:
            # Estatísticas do batch
            batch_mean = np.mean(x, axis=0)
            batch_var = np.var(x, axis=0)

            # Atualiza estatísticas móveis
            self.running_mean = (1 - self.momentum) * self.running_mean + self.momentum * batch_mean
            self.running_var = (1 - self.momentum) * self.running_var + self.momentum * batch_var

            # Normaliza
            x_norm = (x - batch_mean) / np.sqrt(batch_var + self.eps)
        else:
            # Usa estatísticas móveis
            x_norm = (x - self.running_mean) / np.sqrt(self.running_var + self.eps)

        # Scale e shift
        return self.gamma * x_norm + self.beta
```

---

## 📚 RECURSOS PARA APROFUNDAMENTO

### Livros Fundamentais

1. **"Deep Learning"** - Ian Goodfellow, Yoshua Bengio, Aaron Courville
2. **"Pattern Recognition and Machine Learning"** - Christopher Bishop
3. **"The Elements of Statistical Learning"** - Hastie, Tibshirani, Friedman

### Papers Clássicos

1. **"Gradient-based learning applied to document recognition"** - LeCun et al. (1998)
2. **"Deep Residual Learning for Image Recognition"** - He et al. (2016)
3. **"Attention Is All You Need"** - Vaswani et al. (2017)
4. **"Adam: A Method for Stochastic Optimization"** - Kingma & Ba (2014)

### Cursos Online

1. **CS231n** - Stanford (Convolutional Neural Networks)
2. **CS224n** - Stanford (Natural Language Processing)
3. **Fast.ai** - Practical Deep Learning
4. **Deep Learning Specialization** - Coursera (Andrew Ng)

### Implementações de Referência

1. **PyTorch Tutorials**: pytorch.org/tutorials
2. **TensorFlow Guides**: tensorflow.org/guide
3. **Papers with Code**: paperswithcode.com

---

_"Understanding the fundamentals is the key to mastering the advanced"_

**Continue explorando! 🚀**
