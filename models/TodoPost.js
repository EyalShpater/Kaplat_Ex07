
module.exports = (sequelize, DataTypes) => {
    const TodoPost = sequelize.define("todos", {
        rawid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true 
        },
        title: {
            type: DataTypes.STRING
        },
        content: {
            type: DataTypes.STRING
        },
        duedate: {
            type: DataTypes.BIGINT
        },
        state: {
            type: DataTypes.STRING
        },
    });

    return TodoPost;
};