/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export async function paginate<T>(
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  options: {
    page?: number;
    limit?: number;
    where?: any;
    orderBy?: any;
    include?: any;
    select?: any;
  },
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 10));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where: options.where,
      orderBy: options.orderBy ?? { createdAt: 'desc' },
      include: options.include,
      select: options.select,
      skip,
      take: limit,
    }),
    model.count({ where: options.where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
