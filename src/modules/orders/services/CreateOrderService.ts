import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not exists');
    }

    if (!Array.isArray(products)) {
      throw new AppError(`Products list is expected in format Array`);
    }

    if (products.length === 0) {
      throw new AppError(`None product was informed, order wasn't created`);
    }

    const productsFind = products.map(product => {
      return { id: product.id };
    });

    const allProducts = await this.productsRepository.findAllById(productsFind);

    if (allProducts.length === 0) {
      throw new AppError(`Products informed non exists in the system`);
    }

    const orderProducts = products.map(product => {
      const indxProductDB = allProducts.findIndex(
        dbProd => dbProd.id === product.id,
      );

      if (indxProductDB < 0) {
        throw new AppError(`Product ID ${product.id} not exists`);
      }

      const productDB = allProducts[indxProductDB];

      if (product.quantity > productDB.quantity) {
        throw new AppError(
          `Product ID ${product.id}: Quantity requisited not avaliable`,
        );
      }

      allProducts[indxProductDB].quantity -= product.quantity;

      return {
        product_id: product.id,
        price: productDB.price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(allProducts);

    return order;
  }
}

export default CreateOrderService;
